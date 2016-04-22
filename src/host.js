'use strict';

var guid = require('./lib/guid');
var utils = require('./lib/utils');
var Porthole = require('./lib/porthole');
var EventListener = require('./lib/event-listener');
var host = require('./host');

function AppNexusHTML5Lib ()  {
  var self = this;
  this.debug = false;
  this.inFrame = false;
  this.EventListener = EventListener;

  var isClient = false;
  var readyCalled = false;
  var isPageLoaded = false;
  var expandProperties = {}
  var dispatcher = new EventListener();
  var clientPorthole;

  try {
    this.inFrame = (window.self !== window.top);
  } catch (e) {
    this.inFrame = true;
  }

  this.placement = function (mediaURL, landingPageURL, creativeWidth, creativeHeight) {
    if (self.debug) console.info('Host placement created');

    var uid = guid();
    var usingAst = typeof inDapIF != 'undefined' && inDapIF;
    var expandProperties = {};
    var windowProxy = new Porthole.WindowProxy(null, 'an-' + uid);

    /**
     * Add styles needed for a full screen element
     * @param element
     * @param zIndex
     * @returns {*}
     */
    function maximizeElement(element, zIndex) {
      element.style.top = element.style.left = element.style.right = element.style.bottom = 0;
      element.style.width = element.style.height = '100%';
      element.style.position = 'fixed';
      element.style.zIndex = zIndex;
      return element;
    }

    /**
     * Add cross browser css transitions
     * @param el
     * @param cssTransition
     */
    function addCSSTranstions(el, cssTransition) {
      el.style['-webkit-transition'] = cssTransition;
      el.style['-moz-transition'] = cssTransition;
      el.style['-ms-transition'] = cssTransition;
      el.style['transition'] = cssTransition;
    }

    /**
     * Cross browser support for getting document object from an iframe
     * @param frame
     * @returns {*}
     */
    function getFrameContentDoc(frame) {
      var doc;
      try {
        if (frame.contentWindow) {
          doc = frame.contentWindow.document;
        } else if (frame.contentDocument.document) {
          doc = frame.contentDocument.document;
        } else {
          doc = frame.contentDocument;
        }
      } catch (e) {
        if (self.debug) console.error('Error getting iframe document: ' + e);
      }
      return doc;
    }

    /**
     * Gets a reference to a specific iframe from a window based on its contents.
     * Useful for getting a reference to self when in an iframe
     * @param parentWindow
     * @param frameDocument
     * @returns {*}
     */
    function getFrameReference(parentWindow, frameDocument){
      var frame;
      var frames = parentWindow.document.getElementsByTagName("iframe");
      for (var i= frames.length; i-->0;) {
        var d= getFrameContentDoc(frames[i]);
        if (d===frameDocument){
          frame = frames[i];
          break;
        }
      }
      return frame;
    }

    /**
     * Handle expand animation
     * @param frame
     * @param expandProperties
     */
    function expandFrame(frame, expandProperties){
      if (expandProperties.expand && (expandProperties.expand.easing || expandProperties.expand.duration)) {
        addCSSTranstions(frame, utils.sprintf('width, height, %sms %s', parseInt(expandProperties.expand.duration || 400, 10), expandProperties.expand.easing));
      }

      if(!expandProperties.interstitial) {
        if (!isNaN(expandProperties.height)) {
          frame.style.height = expandProperties.height + 'px';
        }
        if (!isNaN(expandProperties.width)) {
          frame.style.width = expandProperties.width + 'px';
        }
      }
    }

    /**
     * Handle collapse animation
     * @param frame
     * @param expandProperties
     */
    function collapseFrame(frame, expandProperties){
      if (expandProperties.collapse && (expandProperties.collapse.easing || expandProperties.collapse.duration)) {
        addCSSTranstions(frame, utils.sprintf('width, height, %sms %s', parseInt(expandProperties.collapse.duration || 400, 10), expandProperties.collapse.easing));
      }
      frame.style.height = creativeHeight + 'px';
      frame.style.width = creativeWidth + 'px';
    }

    /**
     * Ad an overlay to an iframe
     * @param frame
     * @param zIndex
     * @param expandProperties
     */
    function addOverlay(frame, zIndex, expandProperties){
      frame.overlay = document.createElement('div');
      frame.overlay.style.backgroundColor = expandProperties.overlayColor || 'rgba(0,0,0,0.5)';
      document.body.appendChild(frame.overlay);
      maximizeElement(frame.overlay, zIndex);
    }

    /**
     * Remove an overlay from an iframe
     * @param frame
     * @param expandProperties
     */
    function removeOverlay(frame, expandProperties){
      if (frame.overlay) {
        frame.overlay.parentNode.removeChild(frame.overlay); //cross browser compatible way to remove element
        frame.overlay = null;
      }
    }

    windowProxy.addEventListener(function (messageEvent) {
      var adFrame = document.getElementById('an-' + uid);
      var astFrame = usingAst ? getFrameReference(window.parent, document) : false;
      var topWindow = usingAst ? window.parent.window : window;
      var topContainer = usingAst ? astFrame.parentNode : adFrame.parentNode;
      var topFrame = usingAst ? astFrame : adFrame;

      switch(messageEvent.data.action) {

        case 'click':
          topWindow.open(landingPageURL, "_blank");  //leave this for backwards compatibility till next breaking change
          break;

        case 'set-expand-properties':
          expandProperties = messageEvent.data.properties || {};
          if (expandProperties.interstitial) {
            expandProperties.floating = false;
          }
          if (expandProperties.floating) {

            topFrame.style.position = 'absolute';
            topContainer.style.position = 'relative';
            topContainer.style.minWidth = creativeWidth + 'px';
            topContainer.style.minHeight = creativeHeight + 'px';
            if (expandProperties.anchor) {
              if (/^top-/.test(expandProperties.anchor)) topFrame.style.top = '0px';
              if (/-left$/.test(expandProperties.anchor)) topFrame.style.left = '0px';
              if (/-right$/.test(expandProperties.anchor)) topFrame.style.right = '0px';
              if (/^bottom-/.test(expandProperties.anchor)) topFrame.style.bottom = '0px';
            }
          }
          if (expandProperties.expand) {
            expandProperties.collapse = utils.deepExtend({}, expandProperties.expand, expandProperties.collapse);
          }
          break;

        case 'expand':
          if (expandProperties.interstitial) {
            addOverlay(topFrame, 99998, expandProperties);
            maximizeElement(topFrame, 99999);
            //timeout to work around safari rendering bug where popup isn't rendered properly for AST :(
            setTimeout(function(){maximizeElement(adFrame, 100000)}, 100);
          }

          expandFrame(adFrame, expandProperties);
          if (astFrame){
            expandFrame(astFrame, expandProperties);
          }
          break;
        case 'ready':
          var adData = {
            landingPageUrl: landingPageURL
          };
          windowProxy.post({ action: 'setAdData', parameters: adData });
          break;
        case 'collapse':
          if (expandProperties.interstitial) {
            removeOverlay(topFrame, expandProperties);
          }
          collapseFrame(adFrame, expandProperties);
          if (astFrame){
            collapseFrame(astFrame, expandProperties);
          }
          break;
      }
    });

    document.write('<div><iframe id="an-' + uid + '" name="an-' + uid + '" src="' + mediaURL + '" width="' + creativeWidth + '" height="' + creativeHeight + '" frameborder="0" scrolling="no" allowfullscreen="true" style="width: ' + creativeWidth + 'px; height: ' + creativeHeight + 'px; "></iframe></div>');

    return document.getElementById('an-' + uid);

  }
}


var APPNEXUS = new AppNexusHTML5Lib();
if (typeof window !== 'undefined') {
  window.APPNEXUS = APPNEXUS;
}

module.exports = APPNEXUS;
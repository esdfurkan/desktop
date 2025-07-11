// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var gZenOperatingSystemCommonUtils = {
  kZenOSToSmallName: {
    WINNT: 'windows',
    Darwin: 'macos',
    Linux: 'linux',
  },

  get currentOperatingSystem() {
    let os = Services.appinfo.OS;
    return this.kZenOSToSmallName[os];
  },
};

class ZenMultiWindowFeature {
  constructor() {}

  static get browsers() {
    return Services.wm.getEnumerator('navigator:browser');
  }

  static get currentBrowser() {
    return Services.wm.getMostRecentWindow('navigator:browser');
  }

  static get isActiveWindow() {
    return ZenMultiWindowFeature.currentBrowser === window;
  }

  windowIsActive(browser) {
    return browser === ZenMultiWindowFeature.currentBrowser;
  }

  async foreachWindowAsActive(callback) {
    if (!ZenMultiWindowFeature.isActiveWindow) {
      return;
    }
    for (const browser of ZenMultiWindowFeature.browsers) {
      try {
        if (browser.closed) continue;
        await callback(browser);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

class ZenDOMOperatedFeature {
  constructor() {
    var initBound = this.init.bind(this);
    document.addEventListener('DOMContentLoaded', initBound, { once: true });
  }
}

class ZenPreloadedFeature {
  constructor() {
    var initBound = this.init.bind(this);
    document.addEventListener('MozBeforeInitialXULLayout', initBound, { once: true });
  }
}

var gZenCommonActions = {
  copyCurrentURLToClipboard() {
    const currentUrl = gBrowser.currentURI.spec;
    if (currentUrl) {
      let str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
      str.data = currentUrl;
      let transferable = Cc['@mozilla.org/widget/transferable;1'].createInstance(
        Ci.nsITransferable
      );
      transferable.init(window.docShell.QueryInterface(Ci.nsILoadContext));
      transferable.addDataFlavor('text/plain');
      transferable.setTransferData('text/plain', str);
      Services.clipboard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);
      let button;
      if (
        Services.zen.canShare() &&
        (currentUrl.startsWith('http://') || currentUrl.startsWith('https://'))
      ) {
        button = {
          id: 'zen-copy-current-url-button',
          command: (event) => {
            const buttonRect = event.target.getBoundingClientRect();
            Services.zen.share(
              Services.io.newURI(currentUrl),
              '',
              '',
              buttonRect.left,
              window.innerHeight - buttonRect.bottom,
              buttonRect.width,
              buttonRect.height
            );
          },
        };
      }
      gZenUIManager.showToast('zen-copy-current-url-confirmation', { button, timeout: 3000 });
    }
  },
  copyCurrentURLAsMarkdownToClipboard() {
    const currentUrl = gBrowser.currentURI.spec;
    const tabTitle = gBrowser.selectedTab.label;
    if (currentUrl && tabTitle) {
      const markdownLink = `[${tabTitle}](${currentUrl})`;
      let str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
      str.data = markdownLink;
      let transferable = Cc['@mozilla.org/widget/transferable;1'].createInstance(
        Ci.nsITransferable
      );
      transferable.init(window.docShell.QueryInterface(Ci.nsILoadContext));
      transferable.addDataFlavor('text/plain');
      transferable.setTransferData('text/plain', str);
      Services.clipboard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);
      gZenUIManager.showToast('zen-copy-current-url-confirmation');
    }
  },

  throttle(f, delay) {
    let timer = 0;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => f.apply(this, args), delay);
    };
  },
};

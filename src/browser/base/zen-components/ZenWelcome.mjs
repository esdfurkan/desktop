{
  var _tabsToPin = [];
  var _tabsToPinEssentials = [];

  function clearBrowserElements() {
    for (const element of document.getElementById('browser').children) {
      element.style.display = 'none';
    }
  }

  function getMotion() {
    return gZenUIManager.motion;
  }

  async function animate(...args) {
    return getMotion().animate(...args);
  }

  function initializeZenWelcome() {
    document.documentElement.setAttribute('zen-welcome-stage', 'true');
    const XUL = `
      <html:div id="zen-welcome">
        <html:div id="zen-welcome-start">
          <html:h1 class="zen-branding-title" id="zen-welcome-title"></html:h1>
          <button class="footer-button primary" id="zen-welcome-start-button">
          </button>
        </html:div>
        <hbox id="zen-welcome-pages">
          <vbox id="zen-welcome-page-sidebar">
            <vbox id="zen-welcome-page-sidebar-content">
            </vbox>
            <vbox id="zen-welcome-page-sidebar-buttons">
            </vbox>
          </vbox>
          <html:div id="zen-welcome-page-content">
          </html:div>
        </hbox>
      </html:div>
    `;
    const fragment = window.MozXULElement.parseXULToFragment(XUL);
    document.getElementById('browser').appendChild(fragment);
    window.MozXULElement.insertFTLIfNeeded('browser/zen-welcome.ftl');
  }

  function openInitialPinTab() {
    const tabs = ['https://reddit.com/r/zen_browser', 'https://x.com/zen_browser'];
    for (const url of tabs) {
      const tab = window.gBrowser.addTrustedTab(url, {
        inBackground: true,
      });
      _tabsToPin.push(tab);
    }
  }

  function openWelcomeTab() {
    const tab = window.gBrowser.addTrustedTab('https://zen-browser.app/welcome', {
      inBackground: true,
    });
    gBrowser.selectedTab = tab;
  }

  class ZenWelcomePages {
    constructor(pages) {
      this._currentPage = -1;
      this._pages = pages;
      this.init();
      this.next();
    }

    init() {
      document.getElementById('zen-welcome-pages').style.display = 'flex';
      document.getElementById('zen-welcome-start').remove();
      window.maximize();
      animate('#zen-welcome-pages', { opacity: [0, 1] }, { delay: 0.2, duration: 0.2 });
    }

    async fadeInTitles(page) {
      const [title1, description1, description2] = await document.l10n.formatValues(page.text);
      const titleElement = document.getElementById('zen-welcome-page-sidebar-content');
      titleElement.innerHTML =
        `<html:h1>${title1}</html:h1><html:p>${description1}</html:p>` +
        (description2 ? `<html:p>${description2}</html:p>` : '');
      await animate(
        '#zen-welcome-page-sidebar-content > *',
        { x: ['150%', 0] },
        {
          delay: getMotion().stagger(0.05),
          type: 'spring',
          bounce: 0.2,
        }
      );
    }

    async fadeInButtons(page) {
      const buttons = document.getElementById('zen-welcome-page-sidebar-buttons');
      let i = 0;
      for (const button of page.buttons) {
        const buttonElement = document.createXULElement('button');
        document.l10n.setAttributes(buttonElement, button.l10n);
        if (i++ === 0) {
          buttonElement.classList.add('primary');
        }
        buttonElement.classList.add('footer-button');
        buttonElement.addEventListener('click', async () => {
          const shouldSkip = await button.onclick();
          if (shouldSkip) {
            this.next();
          }
        });
        buttons.appendChild(buttonElement);
      }
      await animate(
        '#zen-welcome-page-sidebar-buttons button',
        { x: ['150%', 0] },
        {
          delay: getMotion().stagger(0.1, { startDelay: 0.4 }),
          type: 'spring',
          bounce: 0.2,
        }
      );
    }

    async fadeInContent() {
      await animate(
        '#zen-welcome-page-content > *',
        { opacity: [0, 1] },
        {
          delay: getMotion().stagger(0.1),
          type: 'spring',
          bounce: 0.2,
        }
      );
    }

    async fadeOutButtons() {
      await animate(
        '#zen-welcome-page-sidebar-buttons button',
        { x: [0, '-150%'] },
        {
          type: 'spring',
          bounce: 0,
          delay: getMotion().stagger(0.1, { startDelay: 0.4 }),
        }
      );
      document.getElementById('zen-welcome-page-sidebar-buttons').innerHTML = '';
      document.getElementById('zen-welcome-page-sidebar-content').innerHTML = '';
    }

    async fadeOutTitles() {
      await animate(
        '#zen-welcome-page-sidebar-content > *',
        { x: [0, '-150%'] },
        {
          delay: getMotion().stagger(0.05, { startDelay: 0.3 }),
          type: 'spring',
          bounce: 0,
        }
      );
    }

    async fadeOutContent() {
      await animate(
        '#zen-welcome-page-content > *',
        { opacity: [1, 0] },
        {
          delay: getMotion().stagger(0.05, { startDelay: 0.3 }),
          type: 'spring',
          bounce: 0,
          duration: 0.2,
        }
      );
    }

    async next() {
      if (this._currentPage !== -1) {
        const previousPage = this._pages[this._currentPage];
        const promises = [this.fadeOutTitles(), this.fadeOutButtons()];
        if (!previousPage.dontFadeOut) {
          promises.push(this.fadeOutContent());
        }
        await Promise.all(promises);
        await previousPage.fadeOut();
        document.getElementById('zen-welcome-page-content').innerHTML = '';
      }
      this._currentPage++;
      const currentPage = this._pages[this._currentPage];
      if (!currentPage) {
        this.finish();
        return;
      }
      await Promise.all([this.fadeInTitles(currentPage), this.fadeInButtons(currentPage)]);
      currentPage.fadeIn();
      await this.fadeInContent();
    }

    async finish() {
      ZenWorkspaces.reorganizeTabsAfterWelcome();
      await animate('#zen-welcome-page-content', { x: [0, '100%'] }, { bounce: 0 });
      document.getElementById('zen-welcome-page-content').remove();
      await this.animHeart();
      this._pinRemainingTabs();
      await animate('#zen-welcome-pages', { opacity: [1, 0] });
      document.getElementById('zen-welcome').remove();
      document.documentElement.removeAttribute('zen-welcome-stage');
      for (const element of document.getElementById('browser').children) {
        element.style.opacity = 0;
        element.style.removeProperty('display');
      }
      gZenUIManager.updateTabsToolbar();
      await animate('#browser > *', { opacity: [0, 1] });
      gZenUIManager.showToast('zen-welcome-finished');
    }

    _pinRemainingTabs() {
      for (const tab of _tabsToPin) {
        gBrowser.pinTab(tab);
      }
      for (const tab of _tabsToPinEssentials) {
        gZenPinnedTabManager.addToEssentials(tab);
      }
    }

    async animHeart() {
      const heart = document.createElement('div');
      heart.id = 'zen-welcome-heart';
      const sidebar = document.getElementById('zen-welcome-page-sidebar');
      sidebar.style.width = '100%';
      sidebar.appendChild(heart);
      sidebar.setAttribute('animate-heart', 'true');
      await animate(
        '#zen-welcome-heart',
        { opacity: [0, 1, 1, 1, 0], scale: [0.5, 1, 1.2, 1, 1.2] },
        {
          duration: 1.5,
          delay: 0.2,
          bounce: 0,
        }
      );
    }
  }

  function getWelcomePages() {
    return [
      {
        text: [
          {
            id: 'zen-welcome-import-title',
          },
          {
            id: 'zen-welcome-import-description-1',
          },
          {
            id: 'zen-welcome-import-description-2',
          },
        ],
        buttons: [
          {
            l10n: 'zen-welcome-import-button',
            onclick: async () => {
              MigrationUtils.showMigrationWizard(window, {
                isStartupMigration: true,
              });
              document.querySelector('#zen-welcome-page-sidebar-buttons button').remove();
              const newButton = document.querySelector('#zen-welcome-page-sidebar-buttons button');
              newButton.classList.add('primary');
              document.l10n.setAttributes(newButton, 'zen-welcome-next-action');
              return false;
            },
          },
          {
            l10n: 'zen-welcome-skip-button',
            onclick: async () => {
              return true;
            },
          },
        ],
        fadeIn() {
          const xul = `
            <html:label for="zen-welcome-set-default-browser">
              <html:input type="radio" id="zen-welcome-set-default-browser" name="zen-welcome-set-default-browser"></html:input>
              <html:span data-l10n-id="zen-welcome-set-default-browser"></html:span>
            </html:label>
            <html:label for="zen-welcome-dont-set-default-browser">
              <html:input checked="true" type="radio" id="zen-welcome-dont-set-default-browser" name="zen-welcome-set-default-browser"></html:input>
              <html:span data-l10n-id="zen-welcome-dont-set-default-browser"></html:span>
            </html:label>
          `;
          const fragment = window.MozXULElement.parseXULToFragment(xul);
          document.getElementById('zen-welcome-page-content').appendChild(fragment);
        },
        async fadeOut() {
          const shouldSetDefault = document.getElementById('zen-welcome-set-default-browser').checked;
          if (AppConstants.HAVE_SHELL_SERVICE && shouldSetDefault) {
            let shellSvc = getShellService();
            if (!shellSvc) {
              return;
            }

            try {
              await shellSvc.setDefaultBrowser(false);
            } catch (ex) {
              console.error(ex);
              return;
            }
          }
        },
      },
      {
        text: [
          {
            id: 'zen-welcome-initial-essentials-title',
          },
          {
            id: 'zen-welcome-initial-essentials-description-1',
          },
          {
            id: 'zen-welcome-initial-essentials-description-2',
          },
        ],
        buttons: [
          {
            l10n: 'zen-welcome-next-action',
            onclick: async () => {
              return true;
            },
          },
        ],
        fadeIn() {
          const xul = `
            <hbox id="zen-welcome-initial-essentials-browser">
              <vbox id="zen-welcome-initial-essentials-browser-sidebar">
                <hbox id="zen-welcome-initial-essentials-browser-sidebar-win-buttons">
                  <html:div></html:div>
                  <html:div></html:div>
                  <html:div></html:div>
                </hbox>
                <html:div id="zen-welcome-initial-essentials-browser-sidebar-essentials">
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://web.whatsapp.com" style="--zen-tab-icon: url('https://web.whatsapp.com/favicon.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" visuallyselected="" data-url="https://discord.com" style="--zen-tab-icon: url('https://www.google.com/s2/favicons?domain=discord.com');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://trello.com" style="--zen-tab-icon: url('https://trello.com/favicon.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://slack.com/" style="--zen-tab-icon: url('https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://github.com" style="--zen-tab-icon: url('https://github.githubassets.com/favicons/favicon-dark.png');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://twitter.com" style="--zen-tab-icon: url('https://abs.twimg.com/favicons/twitter.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" visuallyselected="" data-url="https://notion.com" style="--zen-tab-icon: url('https://www.notion.so/front-static/favicon.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" visuallyselected="" data-url="https://calendar.google.com" style="--zen-tab-icon: url('https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_6.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://youtube.com" style="--zen-tab-icon: url('https://www.youtube.com/favicon.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="extra-tab"></html:div>
                  <html:div class="extra-tab"></html:div>
                </html:div>
              </vbox>
            </hbox>
          `;
          const fragment = window.MozXULElement.parseXULToFragment(xul);
          document.getElementById('zen-welcome-page-content').appendChild(fragment);
          document
            .getElementById('zen-welcome-initial-essentials-browser-sidebar-essentials')
            .addEventListener('click', async (event) => {
              const tab = event.target.closest('.tabbrowser-tab');
              if (!tab) {
                return;
              }
              tab.toggleAttribute('visuallyselected');
            });
        },
        fadeOut() {
          const selectedTabs = document
            .getElementById('zen-welcome-initial-essentials-browser-sidebar-essentials')
            .querySelectorAll('.tabbrowser-tab[visuallyselected]');
          for (const tab of selectedTabs) {
            const url = tab.getAttribute('data-url');
            const createdTab = window.gBrowser.addTrustedTab(url, {
              inBackground: true,
            });
            _tabsToPinEssentials.push(createdTab);
          }
          openInitialPinTab();
          openWelcomeTab();
        },
      },
      {
        text: [
          {
            id: 'zen-welcome-workspace-colors-title',
          },
          {
            id: 'zen-welcome-workspace-colors-description',
          },
        ],
        buttons: [
          {
            l10n: 'zen-welcome-next-action',
            onclick: async () => {
              return true;
            },
          },
        ],
        fadeIn() {
          const anchor = document.createElement('div');
          anchor.id = 'zen-welcome-workspace-colors-anchor';
          document.getElementById('zen-welcome-page-content').appendChild(anchor);
          gZenThemePicker.panel.setAttribute('noautohide', 'true');
          gZenThemePicker.panel.setAttribute('consumeoutsideclicks', 'false');
          gZenThemePicker.panel.addEventListener(
            'popupshowing',
            () => {
              const panelRect = gZenThemePicker.panel.getBoundingClientRect();
              // 20 is the shadow width * 2
              anchor.style.height = panelRect.height - 20 + 'px';
              anchor.style.width = panelRect.width - 20 + 'px';
            },
            { once: true }
          );
          PanelMultiView.openPopup(gZenThemePicker.panel, anchor, {
            position: 'overlap',
          });
        },
        dontFadeOut: true,
        async fadeOut() {
          gZenThemePicker.panel.removeAttribute('noautohide');
          gZenThemePicker.panel.removeAttribute('consumeoutsideclicks');
          await animate(gZenThemePicker.panel, { opacity: [1, 0] });
          gZenThemePicker.panel.hidePopup();
          gZenThemePicker.panel.removeAttribute('style');
        },
      },
      {
        text: [
          {
            id: 'zen-welcome-start-browsing-title',
          },
          {
            id: 'zen-welcome-start-browsing-description-1',
          },
        ],
        buttons: [
          {
            l10n: 'zen-welcome-start-browsing',
            onclick: async () => {
              return true;
            },
          },
        ],
        fadeIn() {},
        fadeOut() {},
      },
    ];
  }

  async function animateInitialStage() {
    const [title1, title2] = await document.l10n.formatValues([
      { id: 'zen-welcome-title-line1' },
      { id: 'zen-welcome-title-line2' },
    ]);
    const titleElement = document.getElementById('zen-welcome-title');
    titleElement.innerHTML = `<html:span>${title1}</html:span><html:span>${title2}</html:span>`;
    await animate(
      '#zen-welcome-title span',
      { opacity: [0, 1], y: [20, 0], filter: ['blur(2px)', 'blur(0px)'] },
      {
        delay: getMotion().stagger(0.6, { startDelay: 0.2 }),
        type: 'spring',
        stiffness: 300,
        damping: 20,
        mass: 1.8,
      }
    );
    const button = document.getElementById('zen-welcome-start-button');
    await animate(
      button,
      { opacity: [0, 1], y: [20, 0], filter: ['blur(2px)', 'blur(0px)'] },
      {
        delay: 0.1,
        type: 'spring',
        stiffness: 300,
        damping: 20,
        mass: 1.8,
      }
    );
    button.addEventListener('click', async () => {
      await animate(
        '#zen-welcome-title span, #zen-welcome-start-button',
        { opacity: [1, 0], y: [0, -10], filter: ['blur(0px)', 'blur(2px)'] },
        {
          type: 'spring',
          ease: [0.755, 0.05, 0.855, 0.06],
          bounce: 0.4,
          delay: getMotion().stagger(0.4),
        }
      );
      new ZenWelcomePages(getWelcomePages());
    });
  }

  function centerWindowOnScreen() {
    window.addEventListener(
      'MozAfterPaint',
      function () {
        window.resizeTo(875, 560);
        window.focus();
        const appWin = window.docShell.treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIAppWindow);
        appWin.rollupAllPopups();
        window.moveTo(
          screen.availLeft + (screen.availWidth - outerWidth) / 2,
          screen.availTop + (screen.availHeight - outerHeight) / 2
        );
      },
      { once: true }
    );
  }

  function startZenWelcome() {
    clearBrowserElements();
    centerWindowOnScreen();
    initializeZenWelcome();
    animateInitialStage();
  }

  startZenWelcome();
}

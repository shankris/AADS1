// ------------------------------ BEGIN CONSTANTS ------------------------------

const ClassNames = {
  ROOT: 'accordion',
  GROUP: 'accordion__group',
  PANEL_EXPANDED: 'accordion__panel_expanded' };


const Selectors = {
  TRIGGER: '.accordion__trigger',
  PANEL: '.accordion__panel' };


const Events = {
  BEFORE_COLLAPSE: 'before-collapse',
  COLLAPSE: 'collapse',
  BEFORE_EXPAND: 'before-expand',
  EXPAND: 'expand' };


const Keys = {
  ENTER: 13,
  SPACE: 32,
  END: 35,
  HOME: 36,
  UP: 38,
  DOWN: 40 };


// ------------------------------- END CONSTANTS -------------------------------

// -------------------------- BEGIN UTILITY FUNCTIONS --------------------------

/**
 * Force a reflow
 * @param {HTMLElement} el The element whose styles have been changed
 */
function forceReflow(el) {
  void el.offsetHeight;
}

/**
   * Get transition duration for the specified element
   * @param {HTMLElement} el The element to compute transition duration on
   */
function getTransitionDuration(el) {
  const style = getComputedStyle(el);

  // TODO: handle vendor prefixes
  const duration = style.transitionDuration || '';
  const delay = style.transitionDelay || '';

  if (!duration && !delay) {
    return 0;
  }

  const floatDuration = parseFloat(duration.split(','));
  const floatDelay = parseFloat(delay.split(','));

  const msDuration = (floatDuration + floatDelay) * 1000;
  return isNaN(msDuration) ? 0 : msDuration;
}

function dispatchEvent(el, event, detail) {
  if (typeof window.CustomEvent === 'function') {
    return el.dispatchEvent(new CustomEvent(event, { detail }));
  }


}

// --------------------------- END UTILITY FUNCTIONS ---------------------------

/**
 * Accordion implementation
 */
class Accordion {
  /**
                  * Create an Accordion
                  * @param {HTMLElement} root The root node
                  * @param {Object} options The options object
                  * @param {boolean} options.allowToggle Allow for each header to both open and
                  *    close its panel. Makes it possible for all panels to be closed. Assumes
                  *    only one panel may be open.
                  * @param {boolean} options.allowMultiple Allow for multiple accordion panels
                  *    to be expanded at the same time. Assumes <tt>allowToggle</tt> is set to
                  *    <tt>true</tt>.
                  */
  constructor(root, options = {}) {
    this._root = root;

    this._config = this._getConfig(options);

    this._triggers = [];
    this._panels = [];
    if (!this._config.allowMultiple) {
      this._active = -1;
    }

    [].forEach.call(root.children, (group, i) => {
      if (!group.classList.contains(ClassNames.GROUP)) {
        return;
      }

      const trigger = group.querySelector(Selectors.TRIGGER);
      const panel = group.querySelector(Selectors.PANEL);
      if (trigger == null || panel == null) {
        return;
      }

      this._triggers.push(trigger);
      this._panels.push(panel);

      let isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      if (!this._config.allowMultiple && isExpanded) {
        if (this._active !== -1) {
          // Make sure that only one panel is expanded
          isExpanded = false;
        } else {
          this._active = i;
        }
      }

      // Make sure proper classes are applied
      if (isExpanded) {
        panel.classList.add(ClassNames.PANEL_EXPANDED);
      } else {
        panel.classList.remove(ClassNames.PANEL_EXPANDED);
      }
    });

    if (this._triggers.length === 0) {
      return;
    }

    if (!this._config.allowToggle && this._active === -1) {
      // Make sure at least one panel is expanded
      this._active = 0;
      this._triggers[0].setAttribute('aria-expanded', 'true');
      this._panels[0].classList.add(ClassNames.PANEL_EXPANDED);
    }

    this._isTransitioning = false;

    this._handleTriggerClick = this._handleTriggerClick.bind(this);
    this._handleTriggerKeyDown = this._handleTriggerKeyDown.bind(this);

    this._triggers.forEach(toggle => {
      toggle.addEventListener('click', this._handleTriggerClick);
      toggle.addEventListener('keydown', this._handleTriggerKeyDown);
    });
  }

  // -------------------------- BEGIN PRIVATE METHODS --------------------------

  /**
   * Get configuration options from the provided object and <tt>data-*</tt>
   * attributes on the root element.
   * @param {object} options The configuration options
   * @return {object} an object containing configuration options
   */
  _getConfig(options) {
    const dataset = this._root.dataset;

    const allowToggle = options.allowToggle || !!dataset.allowToggle;
    const allowMultiple = allowToggle && (
    options.allowMultiple || !!dataset.allowMultiple);

    return {
      allowToggle,
      allowMultiple };

  }

  /**
     * Collapse the specified panel
     * @param {number} i The index of the panel to be collapsed
     * @return {Promise} A Promise which resolves when the transition is complete
     */
  _collapsePanel(i) {
    return new Promise(resolve => {
      const trigger = this._triggers[i];
      const panel = this._panels[i];

      trigger.setAttribute('aria-expanded', 'false');

      const currentHeight = panel.getBoundingClientRect().height;
      panel.style.height = currentHeight + 'px';
      forceReflow(panel);

      const transitionDuration = getTransitionDuration(panel);

      panel.style.height = '0';

      dispatchEvent(this._root, Events.BEFORE_COLLAPSE, { index: i });

      setTimeout(() => {
        panel.style.height = '';
        panel.classList.remove(ClassNames.PANEL_EXPANDED);

        dispatchEvent(this._root, Events.COLLAPSE, { index: i });

        resolve();
      }, transitionDuration);
    });
  }

  /**
     * Expand the specified panel
     * @param {number} i The index of the panel to be expanded
     * @return {Promise} A Promise which resolves when the transition is complete
     */
  _expandPanel(i) {
    return new Promise(resolve => {
      const trigger = this._triggers[i];
      const panel = this._panels[i];

      trigger.setAttribute('aria-expanded', 'true');

      panel.classList.add(ClassNames.PANEL_EXPANDED);
      const targetHeight = panel.getBoundingClientRect().height;
      panel.style.height = '0';
      forceReflow(panel);

      const transitionDuration = getTransitionDuration(panel);

      panel.style.height = targetHeight + 'px';

      dispatchEvent(this._root, Events.BEFORE_EXPAND, { index: i });

      setTimeout(() => {
        panel.style.height = '';

        dispatchEvent(this._root, Events.EXPAND, { index: i });

        resolve();
      }, transitionDuration);
    });
  }

  // --------------------------- END PRIVATE METHODS ---------------------------

  // --------------------------- BEGIN EVENT HANDLERS --------------------------

  /**
   * Handle the click event for accordion headers
   * @param {MouseEvent} e The event to be handled
   * @param {number} i The index of the corresponding accordion group
   */
  _handleTriggerClick(e) {
    const groupIndex = this._triggers.indexOf(e.currentTarget);
    this.togglePanel(groupIndex);
  }

  /**
     * Handle the keydown event for accordion headers
     * @param {KeyboardEvent} e The event to be handled
     * @param {number} i The index of the corresponding accordion group
     */
  _handleTriggerKeyDown(e) {
    const { keyCode, currentTarget } = e;

    if (keyCode == Keys.ENTER || keyCode == Keys.SPACE) {
      // Expand/collapse the associated panel
      this.togglePanel(i);

      e.preventDefault();
    } else {
      const groupCount = this._triggers.length;
      let currentIndex = this._triggers.indexOf(currentTarget),nextIndex;

      switch (e.keyCode) {
        case Keys.END:
          // Move focus to the last accordion header
          nextIndex = toggleCount - 1;
          break;

        case Keys.HOME:
          // Move focus to the first accordion header
          nextIndex = 0;
          break;

        case Keys.DOWN:
          // Moves focus to the next accordion header
          nextIndex = (groupCount + currentIndex + 1) % groupCount;
          break;

        case Keys.UP:
          // Move focus to the previous accordion header
          nextIndex = (groupCount + currentIndex - 1) % groupCount;
          break;}


      if (typeof nextIndex !== 'undefined') {
        this._triggers[nextIndex].focus();
        e.preventDefault();
      }
    }
  }

  // ---------------------------- END EVENT HANDLERS ---------------------------

  // --------------------------- BEGIN PUBLIC METHODS --------------------------

  /**
   * Toggle the specified panel
   * @param {number} The index of the panel to toggle
   */
  async togglePanel(i) {
    if (i < 0 || i >= this._panels.length) {
      return;
    }

    if (this._isTransitioning) {
      return;
    }

    if (!this._config.allowToggle && this._active === i) {
      // Configuration requires one panel to be expanded at all times
      return;
    }

    const trigger = this._triggers[i];
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    const isDisabled = trigger.getAttribute('aria-disabled') === 'true';

    if (isExpanded && isDisabled) {
      // The panel isn't permitted to be collapsed
      return;
    }

    this._isTransitioning = true;

    if (this._config.allowToggle) {
      if (isExpanded) {
        await this._collapsePanel(i);

        if (!this._config.allowMultiple) {
          this._active = -1;
        }
      } else {
        await this._expandPanel(i);

        if (!this._config.allowMultiple) {
          this._active = i;
        }
      }
    } else {
      await Promise.all([
      this._collapsePanel(this._active),
      this._expandPanel(i)]);


      this._active = i;
    }

    this._isTransitioning = false;
  }

  // ---------------------------- END PUBLIC METHODS ---------------------------
}

(function initAll() {
  [].forEach.call(document.getElementsByClassName(ClassNames.ROOT), elem => {
    new Accordion(elem);
  });
})();
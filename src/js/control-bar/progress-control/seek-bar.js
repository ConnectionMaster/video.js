/**
 * @file seek-bar.js
 */
import Slider from '../../slider/slider.js';
import Component from '../../component.js';
import * as Fn from '../../utils/fn.js';
import formatTime from '../../utils/format-time.js';
import computedStyle from '../../utils/computed-style.js';
import window from 'global/window';

import './load-progress-bar.js';
import './play-progress-bar.js';
import './tooltip-progress-bar.js';

/**
 * Seek Bar and holder for the progress bars
 *
 * @extends Slider
 */
class SeekBar extends Slider {

  /**
   * Creates an instance of this class.
   *
   * @param {Player} player
   *        The `Player` that this class should be attached to.
   *
   * @param {Object} [options]
   *        The key/value store of player options.
   */
  constructor(player, options) {
    super(player, options);
    this.on(player, 'timeupdate', this.updateProgress);
    this.on(player, 'ended', this.updateProgress);
    player.ready(Fn.bind(this, this.updateProgress));

    this.handleGlobalMouseMove = this.handleGlobalMouseMove.bind(this);
    this.handleGlobalMouseUp = this.handleGlobalMouseUp.bind(this);

    if (options.playerOptions &&
        options.playerOptions.controlBar &&
        options.playerOptions.controlBar.progressControl &&
        options.playerOptions.controlBar.progressControl.keepTooltipsInside) {
      this.keepTooltipsInside = options.playerOptions.controlBar.progressControl.keepTooltipsInside;
    }

    if (this.keepTooltipsInside) {
      this.tooltipProgressBar = this.addChild('TooltipProgressBar');
    }
  }

  /**
   * Create the `Component`'s DOM element
   *
   * @return {Element}
   *         The element that was created.
   */
  createEl() {
    return super.createEl('div', {
      className: 'vjs-progress-holder'
    }, {
      'aria-label': 'progress bar'
    });
  }

  /**
   * Update the seek bars tooltip and width.
   *
   * @param {EventTarget~Event} [event]
   *        The `timeupdate` or `ended` event that caused this to run.
   *
   * @listens Player#timeupdate
   * @listens Player#ended
   */
  updateProgress(event) {
    this.updateAriaAttributes(this.el_);

    if (this.keepTooltipsInside) {
      this.updateAriaAttributes(this.tooltipProgressBar.el_);
      this.tooltipProgressBar.el_.style.width = this.bar.el_.style.width;

      const playerWidth = parseFloat(computedStyle(this.player().el(), 'width'));
      const tooltipWidth = parseFloat(computedStyle(this.tooltipProgressBar.tooltip, 'width'));
      const tooltipStyle = this.tooltipProgressBar.el().style;

      tooltipStyle.maxWidth = Math.floor(playerWidth - (tooltipWidth / 2)) + 'px';
      tooltipStyle.minWidth = Math.ceil(tooltipWidth / 2) + 'px';
      tooltipStyle.right = `-${tooltipWidth / 2}px`;
    }
  }

  /**
   * Update ARIA accessibility attributes
   *
   * @param {Element} el
   *        The element to update with aria accessibility attributes.
   */
  updateAriaAttributes(el) {
    // Allows for smooth scrubbing, when player can't keep up.
    const time = (this.player_.scrubbing()) ? this.player_.getCache().currentTime : this.player_.currentTime();

    // machine readable value of progress bar (percentage complete)
    el.setAttribute('aria-valuenow', (this.getPercent() * 100).toFixed(2));
    // human readable value of progress bar (time complete)
    el.setAttribute('aria-valuetext', formatTime(time, this.player_.duration()));
  }

  /**
   * Get percentage of video played
   *
   * @return {number}
   *         The percentage played
   */
  getPercent() {
    const percent = this.player_.currentTime() / this.player_.duration();

    return percent >= 1 ? 1 : percent;
  }

  handleGlobalMouseMove(event) {
    this.handleMouseMove(event);
  }

  handleGlobalMouseUp(event) {
    this.handleMouseUp(event);
  }

  /**
   * Handle mouse down on seek bar
   *
   * @param {EventTarget~Event} event
   *        The `mousedown` event that caused this to run.
   *
   * @listens mousedown
   */
  handleMouseDown(event) {
    this.player_.scrubbing(true);

    this.videoWasPlaying = !this.player_.paused();
    this.player_.pause();

    /* An iframe can only access its parent if they are on the same domain (Same Origin Policy).
     * On production, VILOS and the host app are on the same domain but in testing they aren't.
     * The easiest way to check is just to access it and catch the exception if we don't have access.
     */
    try {
      window.parent.addEventListener('mousemove', this.handleGlobalMouseMove);
      window.parent.addEventListener('mouseup', this.handleGlobalMouseUp);
    } catch (e) {
      // Can't access parent
    }

    super.handleMouseDown(event);
  }

  /**
   * Handle mouse move on seek bar
   *
   * @param {EventTarget~Event} event
   *        The `mousemove` event that caused this to run.
   *
   * @listens mousemove
   */
  handleMouseMove(event) {
    let newTime = this.calculateDistance(event) * this.player_.duration();

    // Don't let video end while scrubbing.
    if (newTime === this.player_.duration()) {
      newTime = newTime - 0.1;
    }

    // Set new time (tell player to seek to new time)
    this.player_.currentTime(newTime);

    /* timeupdate isn't guaranteed to fire every time it updates
     * Therefore we want to force the UI to update immediately - Ellation
     */
    this.player_.controlBar.currentTimeDisplay.updateContent(null);
    this.player_.controlBar.progressControl.seekBar.playProgressBar.updateDataAttr(null);
    this.player_.controlBar.progressControl.seekBar.update();
  }

  /**
   * Handle mouse up on seek bar
   *
   * @param {EventTarget~Event} event
   *        The `mouseup` event that caused this to run.
   *
   * @listens mouseup
   */
  handleMouseUp(event) {
    super.handleMouseUp(event);

    /* An iframe can only access its parent if they are on the same domain.
     * On production, VILOS and the host app are on the same domain but in testing they aren't.
     * The easiest way to check is just to access it and catch the exception if we don't have access.
     */
    try {
      window.parent.removeEventListener('mousemove', this.handleGlobalMouseMove); // eslint-disable-line no-undef
      window.parent.removeEventListener('mouseup', this.handleGlobalMouseUp); // eslint-disable-line no-undef
    } catch (e) {
      // Can't access parent
    }

    this.player_.scrubbing(false);
    if (this.videoWasPlaying) {
      this.player_.play();
    }
  }

  /**
   * Move more quickly fast forward for keyboard-only users
   */
  stepForward() {
    // more quickly fast forward for keyboard-only users
    this.player_.currentTime(this.player_.currentTime() + 5);
  }

  /**
   * Move more quickly rewind for keyboard-only users
   */
  stepBack() {
    // more quickly rewind for keyboard-only users
    this.player_.currentTime(this.player_.currentTime() - 5);
  }

}

/**
 * Default options for the `SeekBar`
 *
 * @type {Object}
 * @private
 */
SeekBar.prototype.options_ = {
  children: [
    'loadProgressBar',
    'mouseTimeDisplay',
    'playProgressBar'
  ],
  barName: 'playProgressBar'
};

/**
 * Call the update event for this Slider when this event happens on the player.
 *
 * @type {string}
 */
SeekBar.prototype.playerEvent = 'timeupdate';

Component.registerComponent('SeekBar', SeekBar);
export default SeekBar;

import { BaseScreen } from './base.screen';
import { TemplateCategoryId } from '@roleplayx/engine-sdk';
import { EventService } from '../../event/service';

/**
 * Animation Menu Screen Handler
 * Handles all events related to the animation menu screen
 */
export class AnimationMenuScreen extends BaseScreen {
  getScreenName(): string {
    return TemplateCategoryId.AnimationMenu;
  }

  async onInitialized(data?: any): Promise<void> {
    this.logger.info('[AnimationMenuScreen] Initialized', data);
    // Don't set focus on initialization - only when screen is actually shown
    // Explicitly disable focus to ensure mouse doesn't appear when screen is hidden
    this.platformAdapter.webview.setWebViewFocus(false, false);
  }

  async onShown(data?: any): Promise<void> {
    this.logger.info('[AnimationMenuScreen] Screen shown');
    // Only enable webview focus when screen is actually shown (not hidden)
    this.platformAdapter.webview.setWebViewFocus(true, true);
  }

  async onHidden(data?: any): Promise<void> {
    this.logger.info('[AnimationMenuScreen] Screen hidden');
    // Disable webview focus when menu is hidden
    this.platformAdapter.webview.setWebViewFocus(false, false);
  }

  async onClosed(data?: any): Promise<void> {
    this.logger.info('[AnimationMenuScreen] Screen closed');
    // Disable webview focus when menu is closed
    this.platformAdapter.webview.setWebViewFocus(false, false);
  }

  /**
   * Handle bindAnimations event from UI
   * This event is forwarded to AnimationService via event service
   */
  async onBindAnimations(data?: { animations?: any[] }): Promise<void> {
    this.logger.info('[AnimationMenuScreen] bindAnimations event received', data);
    const eventService = this.context.getService(EventService);
    // Forward to AnimationService via event service (it listens to 'bindAnimations')
    eventService.emit('bindAnimations' as any, data as { animations: any[] });
  }

  /**
   * Handle playAnimation event from UI
   * This event is forwarded to AnimationService via event service
   */
  async onPlayAnimation(data?: { animation?: any }): Promise<void> {
    this.logger.info('[AnimationMenuScreen] playAnimation event received', data);
    const eventService = this.context.getService(EventService);
    // Forward to AnimationService via event service (it listens to 'playAnimation')
    eventService.emit('playAnimation' as any, data as { animation: any });
  }

  /**
   * Handle pause event from UI
   * This event is forwarded to AnimationService via event service
   */
  async onPause(data?: any): Promise<void> {
    this.logger.info('[AnimationMenuScreen] pause event received', data);
    const eventService = this.context.getService(EventService);
    // Forward to AnimationService via event service (it listens to 'animation:pause')
    eventService.emit('animation:pause' as any, data);
  }

  /**
   * Handle repeat event from UI
   * This event is forwarded to AnimationService via event service
   */
  async onRepeat(data?: any): Promise<void> {
    this.logger.info('[AnimationMenuScreen] repeat event received', data);
    const eventService = this.context.getService(EventService);
    // Forward to AnimationService via event service (it listens to 'animation:repeat')
    eventService.emit('animation:repeat' as any, data);
  }

  /**
   * Handle move event from UI
   * This event is forwarded to AnimationService via event service
   */
  async onMove(data?: any): Promise<void> {
    this.logger.info('[AnimationMenuScreen] move event received', data);
    const eventService = this.context.getService(EventService);
    // Forward to AnimationService via event service (it listens to 'animation:move')
    eventService.emit('animation:move' as any, data);
  }

  /**
   * Handle enablePositionSelector event from UI (torso)
   * This event is forwarded to AnimationService via event service
   */
  async onEnablePositionSelector(data?: any): Promise<void> {
    this.logger.info('[AnimationMenuScreen] enablePositionSelector event received', data);
    const eventService = this.context.getService(EventService);
    // Forward to AnimationService via event service (it listens to 'animation:enablePositionSelector')
    eventService.emit('animation:enablePositionSelector' as any, data);
  }

  /**
   * Handle any custom screen event
   */
  async handleEvent(eventType: string, data?: unknown): Promise<void> {
    // Handle animation-related events
    if (eventType === 'bindAnimations') {
      await this.onBindAnimations(data as { animations?: any[] });
      return;
    }
    
    if (eventType === 'playAnimation') {
      await this.onPlayAnimation(data as { animation?: any });
      return;
    }

    if (eventType === 'pause') {
      await this.onPause(data);
      return;
    }

    if (eventType === 'repeat') {
      await this.onRepeat(data);
      return;
    }

    if (eventType === 'move') {
      await this.onMove(data);
      return;
    }

    if (eventType === 'enablePositionSelector') {
      await this.onEnablePositionSelector(data);
      return;
    }

    // Handle other events with dynamic handler lookup
    const handlerName = `on${eventType
      .split(/(?=[A-Z])/)
      .map((part, index) => {
        if (index === 0) {
          return part.charAt(0).toUpperCase() + part.slice(1);
        }
        return part;
      })
      .join('')}`;

    const handler = (this as any)[handlerName];

    if (handler && typeof handler === 'function') {
      await handler.call(this, data);
    } else {
      this.logger.debug(`[AnimationMenuScreen] No handler for event: ${eventType}`, data);
    }
  }
}


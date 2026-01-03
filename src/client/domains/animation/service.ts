import { RPClientService } from '../../core/client-service';
import { ClientTypes } from '../../core/types';
import { CharacterAnimation, PlayerApi, EngineClient, SessionTokenAuthorization, TemplateCategoryId } from '@roleplayx/engine-sdk';
import { Vector3 } from '../../../shared';
import { WebViewService } from '../webview/service';

/**
 * Animation prop configuration
 */
export interface AnimationProp {
  model: string;
  bone: number;
  position: Vector3;
  rotation: Vector3;
}

/**
 * Parsed animation data with all attributes
 */
export interface ParsedAnimation extends CharacterAnimation {
  dictionary: string;
  name: string;
  flag: number;
  type: 'DEFAULT' | 'SYNCED' | 'WALKSTYLE' | 'EXPRESSION' | 'OFFSET_FRONT' | 'MOVE';
  props: AnimationProp[];
  duration: number; // in milliseconds
}

/**
 * Service for managing character animations.
 *
 * This service provides:
 * - Animation caching by ID and key
 * - Animation playback with support for props, expressions, walkstyles
 * - Animation control (pause, repeat, move)
 * - Integration with PlayerApi for fetching animations
 *
 * @example
 * ```typescript
 * const animationService = context.getService(AnimationService);
 *
 * // Play animation by ID
 * await animationService.playAnimationById('anim_123');
 *
 * // Play animation by key
 * await animationService.playAnimationByKey('wave');
 *
 * // Play animation with full object
 * await animationService.playAnimation(animationObject);
 * ```
 */
export class AnimationService extends RPClientService<ClientTypes> {
  /**
   * Cache mapping: animationId -> ParsedAnimation
   */
  private animationsById: Map<string, ParsedAnimation> = new Map();

  /**
   * Cache mapping: animationKey -> animationId
   */
  private animationIdByKey: Map<string, string> = new Map();

  /**
   * Currently playing animation
   */
  private currentAnimation: ParsedAnimation | null = null;
  private currentProps: number[] = []; // Entity handles for props
  private isPaused = false;
  private isRepeat = false;
  private isTorso = false;

  /**
   * Cached PlayerApi instance
   */
  private _playerApi: PlayerApi | null = null;

  /**
   * PlayerApi instance for fetching animations
   */
  private get playerApi(): PlayerApi {
    if (!this._playerApi) {
      const engineClient = this.createEngineClient();
      this._playerApi = new PlayerApi(engineClient);
    }
    return this._playerApi;
  }

  /**
   * Creates EngineClient instance from session context
   */
  private createEngineClient(): EngineClient {
    const sessionId = this.getSessionId();
    const sessionToken = this.getSessionToken();
    const engineApiUrl = this.getEngineApiUrl();
    const serverId = this.getServerId();

    if (!sessionId || !sessionToken || !engineApiUrl || !serverId) {
      throw new Error('Missing session information for API calls');
    }

    return new EngineClient(
      {
        apiUrl: engineApiUrl,
        applicationName: 'engine-framework',
        serverId: serverId,
      },
      new SessionTokenAuthorization(sessionId, sessionToken),
    );
  }

  /**
   * Gets session ID from URL params or localStorage
   */
  private getSessionId(): string | null {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sessionId') || localStorage.getItem('sessionId') || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Gets session token from URL params or localStorage
   */
  private getSessionToken(): string | null {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sessionToken') || localStorage.getItem('sessionToken') || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Gets engine API URL from URL params or localStorage
   */
  private getEngineApiUrl(): string | null {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('engineApiUrl') || localStorage.getItem('engineApiUrl') || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Gets server ID from URL params or localStorage
   */
  private getServerId(): string | null {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('serverId') || localStorage.getItem('serverId') || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async init(): Promise<void> {
    this.logger.info('Initializing animation service...');
    this.setupEventListeners();
    this.registerCommands();
    await super.init();
  }

  /**
   * Registers commands for animation system
   */
  private registerCommands(): void {
    // Register /anim command
    if (this.platformAdapter.core.registerCommand) {
      this.platformAdapter.core.registerCommand('anim', (args: string[]) => {
        const key = args[0];
        
        // If no argument provided, toggle animation menu
        if (!key) {
          this.toggleAnimationMenu();
          return;
        }
        
        // If argument provided, play animation by key
        this.playAnimationByKey(key).catch((error) => {
          this.logger.error(`Failed to play animation ${key}:`, error);
        });
      });
    } else {
      this.logger.warn('registerCommand not available on platform adapter');
    }
  }

  /**
   * Toggles the animation menu visibility
   */
  public async toggleAnimationMenu(): Promise<void> {
    const webViewService = this.context.getService(WebViewService);
    const animationMenuScreen = TemplateCategoryId.AnimationMenu;
    
    const screenState = webViewService.getScreenState(animationMenuScreen);
    const isActive = webViewService.isScreenActive(animationMenuScreen);
    
    // Check if screen exists and is currently visible
    // isScreenActive returns true only for SHOWN/INITIALIZED screens
    if (isActive) {
      // Menu is visible, hide it
      webViewService.hideScreen(animationMenuScreen);
      this.logger.info('Animation menu hidden');
    } else if (screenState) {
      // Screen exists but is hidden, show it
      await webViewService.showScreen(animationMenuScreen, undefined, 'screen');
      this.logger.info('Animation menu shown (was hidden)');
    } else {
      // Screen doesn't exist, create and show it
      await webViewService.showScreen(animationMenuScreen, undefined, 'screen');
      this.logger.info('Animation menu shown (new)');
    }
  }

  private setupEventListeners(): void {
    // Listen for bindAnimations event from UI
    this.eventService.on('bindAnimations', (data: { animations: CharacterAnimation[] }) => {
      this.handleBindAnimations(data.animations);
    });

    // Listen for playAnimation event from UI
    this.eventService.on('playAnimation', (data: { animation: CharacterAnimation }) => {
      this.playAnimation(data.animation);
    });

    // Listen for animation control events
    this.eventService.on('animation:pause', () => {
      this.setPause(!this.isPaused);
    });

    this.eventService.on('animation:repeat', () => {
      this.setRepeat(!this.isRepeat);
    });

    this.eventService.on('animation:move', () => {
      // TODO: Implement move functionality
      this.logger.info('Move animation requested');
    });

    this.eventService.on('animation:enablePositionSelector', () => {
      this.setTorso(!this.isTorso);
    });
  }

  /**
   * Handles bindAnimations event from UI to populate cache
   */
  private handleBindAnimations(animations: CharacterAnimation[]): void {
    for (const animation of animations) {
      const parsed = this.parseAnimation(animation);
      this.animationsById.set(animation.id, parsed);
      
      if (animation.key) {
        this.animationIdByKey.set(animation.key, animation.id);
      }
    }

    this.logger.debug(`Cached ${animations.length} animations`);
  }

  /**
   * Parses a CharacterAnimation into ParsedAnimation
   */
  private parseAnimation(animation: CharacterAnimation): ParsedAnimation {
    const attrs = animation.attributes;
    
    const dictionary = attrs.DICTIONARY || '';
    const name = attrs.NAME || '';
    const flag = attrs.FLAG ? parseInt(attrs.FLAG, 10) : 1;
    const type = (attrs.TYPE || 'DEFAULT') as ParsedAnimation['type'];
    
    // Parse props
    const props: AnimationProp[] = [];
    let propIndex = 0;
    
    while (attrs[`PROP_${propIndex}_MODEL`]) {
      const model = attrs[`PROP_${propIndex}_MODEL`];
      const bone = parseInt(attrs[`PROP_${propIndex}_BONE`] || '0', 10);
      const posX = parseFloat(attrs[`PROP_${propIndex}_POS_X`] || '0');
      const posY = parseFloat(attrs[`PROP_${propIndex}_POS_Y`] || '0');
      const posZ = parseFloat(attrs[`PROP_${propIndex}_POS_Z`] || '0');
      const rotX = parseFloat(attrs[`PROP_${propIndex}_ROT_X`] || '0');
      const rotY = parseFloat(attrs[`PROP_${propIndex}_ROT_Y`] || '0');
      const rotZ = parseFloat(attrs[`PROP_${propIndex}_ROT_Z`] || '0');

      props.push({
        model,
        bone,
        position: new Vector3(posX, posY, posZ),
        rotation: new Vector3(rotX, rotY, rotZ),
      });

      propIndex++;
    }

    return {
      ...animation,
      dictionary,
      name,
      flag,
      type,
      props,
      duration: animation.duration,
    };
  }

  /**
   * Plays an animation by ID
   */
  public async playAnimationById(animationId: string): Promise<void> {
    let animation = this.animationsById.get(animationId);

    if (!animation) {
      // Fetch from API
      try {
        const fetched = await this.playerApi.getMyAnimationById(animationId);
        animation = this.parseAnimation(fetched);
        this.animationsById.set(animationId, animation);
        
        if (fetched.key) {
          this.animationIdByKey.set(fetched.key, animationId);
        }
      } catch (error) {
        this.logger.error(`Failed to fetch animation ${animationId}:`, error);
        return;
      }
    }

    await this.playAnimation(animation);
  }

  /**
   * Plays an animation by key
   */
  public async playAnimationByKey(key: string): Promise<void> {
    const animationId = this.animationIdByKey.get(key);
    
    if (animationId) {
      await this.playAnimationById(animationId);
      return;
    }

    // Fetch from API with key query
    try {
      const result = await this.playerApi.getMyAnimations({ key, pageSize: 1 });
      
      if (result.items.length === 0) {
        this.logger.warn(`No animation found with key: ${key}`);
        return;
      }

      const animation = this.parseAnimation(result.items[0]);
      this.animationsById.set(animation.id, animation);
      this.animationIdByKey.set(key, animation.id);
      
      await this.playAnimation(animation);
    } catch (error) {
      this.logger.error(`Failed to fetch animation by key ${key}:`, error);
    }
  }

  /**
   * Plays an animation with full object
   */
  public async playAnimation(animation: CharacterAnimation | ParsedAnimation): Promise<void> {
    const parsed = 'dictionary' in animation ? animation : this.parseAnimation(animation);
    
    // Cache if not already cached
    if (!this.animationsById.has(parsed.id)) {
      this.animationsById.set(parsed.id, parsed);
      
      if (parsed.key) {
        this.animationIdByKey.set(parsed.key, parsed.id);
      }
    }

    // Stop current animation
    await this.stopAnimation();

    this.currentAnimation = parsed;

    const ped = this.platformAdapter.player.getPlayerPed();

    // Handle different animation types
    switch (parsed.type) {
      case 'EXPRESSION':
        this.platformAdapter.player.setFacialIdleAnimOverride(ped, parsed.name, parsed.dictionary);
        break;

      case 'WALKSTYLE':
        await this.platformAdapter.player.setPedMovementClipset(ped, parsed.name, 0.2);
        break;

      case 'SYNCED':
        // TODO: Implement synced animation logic
        this.logger.warn('Synced animations not yet implemented');
        break;

      case 'DEFAULT':
      case 'OFFSET_FRONT':
      case 'MOVE':
      default:
        await this.playDefaultAnimation(parsed, ped);
        break;
    }
  }

  /**
   * Plays a default animation with props if needed
   */
  private async playDefaultAnimation(animation: ParsedAnimation, ped: number): Promise<void> {
    // Load animation dictionary
    const loaded = await this.platformAdapter.player.loadAnimDict(animation.dictionary);
    if (!loaded) {
      this.logger.error(`Failed to load animation dictionary: ${animation.dictionary}`);
      return;
    }

    // Create and attach props
    if (animation.props.length > 0) {
      const pedCoords = this.platformAdapter.player.getEntityCoords(ped);
      
      for (const propConfig of animation.props) {
        try {
          const prop = await this.platformAdapter.player.createProp(
            propConfig.model,
            new Vector3(pedCoords.x, pedCoords.y, pedCoords.z + 0.2)
          );

          const boneIndex = this.platformAdapter.player.getPedBoneIndex(ped, propConfig.bone);
          this.platformAdapter.player.attachEntityToEntity(
            prop,
            ped,
            boneIndex,
            propConfig.position,
            propConfig.rotation
          );

          this.currentProps.push(prop);
        } catch (error) {
          this.logger.error(`Failed to create prop ${propConfig.model}:`, error);
        }
      }
    }

    // Calculate duration
    let duration = animation.duration;
    if (duration === 0) {
      // Get duration from native
      const durationSeconds = this.platformAdapter.player.getAnimDuration(animation.dictionary, animation.name);
      duration = durationSeconds > 0 ? durationSeconds * 1000 : -1;
    } else {
      duration = duration / 1000; // Convert to seconds
    }

    // Determine flag
    let flag = animation.flag;
    if (this.isTorso) {
      flag = 51; // Upper body only
    } else if (this.isRepeat) {
      flag = 1; // Repeat
    }

    // Play animation
    this.platformAdapter.player.taskPlayAnim(
      ped,
      animation.dictionary,
      animation.name,
      5.0, // blendInSpeed
      5.0, // blendOutSpeed
      duration,
      flag,
      0, // playbackRate
      false, // lockX
      false, // lockY
      false // lockZ
    );

    // Start pause/repeat monitoring if needed
    if (this.isPaused || this.isRepeat) {
      this.startAnimationControlLoop();
    }
  }

  /**
   * Starts the animation control loop for pause/repeat functionality
   */
  private startAnimationControlLoop(): void {
    // This will be called on every tick while animation is playing
    // Implementation will be done via tick system
  }

  /**
   * Stops the current animation
   */
  public async stopAnimation(): Promise<void> {
    if (this.currentAnimation) {
      const ped = this.platformAdapter.player.getPlayerPed();
      this.platformAdapter.player.clearPlayerTasks();

      // Remove props
      for (const prop of this.currentProps) {
        this.platformAdapter.player.deleteEntity(prop);
      }
      this.currentProps = [];

      this.currentAnimation = null;
    }
  }

  /**
   * Sets pause state
   */
  public setPause(paused: boolean): void {
    this.isPaused = paused;
    
    if (this.currentAnimation) {
      const ped = this.platformAdapter.player.getPlayerPed();
      const speed = paused ? 0 : 1.0;
      this.platformAdapter.player.setEntityAnimSpeed(
        ped,
        this.currentAnimation.dictionary,
        this.currentAnimation.name,
        speed
      );
    }
  }

  /**
   * Sets repeat state
   */
  public setRepeat(repeat: boolean): void {
    this.isRepeat = repeat;
    // Animation will be restarted with new flag if currently playing
  }

  /**
   * Sets torso (upper body only) state
   */
  public setTorso(torso: boolean): void {
    this.isTorso = torso;
    // Animation will be restarted with new flag if currently playing
  }

  /**
   * Gets animation by ID from cache
   */
  public getAnimationById(animationId: string): ParsedAnimation | undefined {
    return this.animationsById.get(animationId);
  }

  /**
   * Gets animation by key from cache
   */
  public getAnimationByKey(key: string): ParsedAnimation | undefined {
    const animationId = this.animationIdByKey.get(key);
    return animationId ? this.animationsById.get(animationId) : undefined;
  }

  public async dispose(): Promise<void> {
    await this.stopAnimation();
    this.animationsById.clear();
    this.animationIdByKey.clear();
    await super.dispose();
  }
}


import i18n from './i18n';
import { bilibiliDanmuParseFromUrl } from './bilibili';
import getDanmuTop from './getDanmuTop';

export default class Danmuku {
    constructor(art, option) {
        art.i18n.update(i18n);
        this.art = art;
        this.utils = art.constructor.utils;
        this.validator = art.constructor.validator;

        this.queue = [];
        this.option = {};
        this.config(option);
        this.isStop = false;
        this.isHide = false;
        this.animationFrameTimer = null;
        this.$danmuku = art.template.$danmuku;

        art.on('video:play', this.start.bind(this));
        art.on('video:playing', this.start.bind(this));
        art.on('video:pause', this.stop.bind(this));
        art.on('video:waiting', this.stop.bind(this));
        art.on('resize', this.resize.bind(this));
        art.on('destroy', this.stop.bind(this));

        this.load();
    }

    static get option() {
        return {
            danmuku: [],
            speed: 5,
            maxlength: 50,
            margin: [10, 100],
            opacity: 1,
            fontSize: 25,
            synchronousPlayback: false,
        };
    }

    static get scheme() {
        return {
            danmuku: 'array|function|string',
            speed: 'number',
            maxlength: 'number',
            margin: 'array',
            opacity: 'number',
            fontSize: 'number',
            synchronousPlayback: 'boolean',
        };
    }

    get isRotate() {
        return this.art.plugins.autoOrientation && this.art.plugins.autoOrientation.state;
    }

    filter(state, callback) {
        return this.queue.filter((danmu) => danmu.$state === state).map(callback);
    }

    getRect(ref, key) {
        const rect = ref.getBoundingClientRect();

        const bottom = rect.bottom;
        const height = rect.height;
        const left = rect.left;
        const right = rect.right;
        const top = rect.top;
        const width = rect.width;
        const x = rect.x;
        const y = rect.y;

        const result = {
            bottom,
            height,
            left,
            right,
            top,
            width,
            x,
            y,
        };

        if (this.isRotate) {
            result.bottom = left;
            result.left = top;
            result.top = right;
            result.right = bottom;
            result.height = width;
            result.width = height;
            result.x = y;
            result.y = x;
        }

        return key ? result[key] : result;
    }

    getDanmuRef() {
        const result = this.queue.find((danmu) => {
            return danmu.$ref && danmu.$state === 'wait';
        });

        if (result) {
            const { $ref } = result;
            result.$ref = null;
            return $ref;
        }

        const $ref = document.createElement('div');
        $ref.style.cssText = `
            user-select: none;
            position: absolute;
            white-space: pre;
            pointer-events: none;
            perspective: 500px;
            display: inline-block;
            will-change: transform;
            font-family: SimHei, "Microsoft JhengHei", Arial, Helvetica, sans-serif;
            font-weight: normal;
            line-height: 1.125;
            text-shadow: rgb(0, 0, 0) 1px 0px 1px, rgb(0, 0, 0) 0px 1px 1px, rgb(0, 0, 0) 0px -1px 1px, rgb(0, 0, 0) -1px 0px 1px;
        `;

        return $ref;
    }

    async load() {
        this.queue = [];
        this.$danmuku.innerText = '';
        let danmus = [];

        try {
            if (typeof this.option.danmuku === 'function') {
                danmus = await this.option.danmuku();
            } else if (typeof this.option.danmuku.then === 'function') {
                danmus = await this.option.danmuku;
            } else if (typeof this.option.danmuku === 'string') {
                danmus = await bilibiliDanmuParseFromUrl(this.option.danmuku);
            } else {
                danmus = this.option.danmuku;
            }

            this.utils.errorHandle(Array.isArray(danmus), 'Danmuku need return an array as result');
            this.art.emit('artplayerPluginDanmuku:loaded', danmus);
            danmus.forEach(this.emit.bind(this));
        } catch (error) {
            this.art.emit('artplayerPluginDanmuku:error', error);
            throw error;
        }

        return this;
    }

    config(option) {
        const { clamp } = this.utils;

        this.option = Object.assign({}, Danmuku.option, this.option, option);
        this.validator(this.option, Danmuku.scheme);

        this.option.speed = clamp(this.option.speed, 1, 10);
        this.option.maxlength = clamp(this.option.maxlength, 10, 100);
        this.option.margin[0] = clamp(this.option.margin[0], 0, 200);
        this.option.margin[1] = clamp(this.option.margin[1], 0, 200);
        this.option.opacity = clamp(this.option.opacity, 0, 1);
        this.option.fontSize = clamp(this.option.fontSize, 12, 100);

        this.art.emit('artplayerPluginDanmuku:config', this.option);

        return this;
    }

    continue() {
        this.filter('stop', (danmu) => {
            danmu.$state = 'emit';
            danmu.$ref.dataset.state = 'emit';
            danmu.$lastStartTime = Date.now();
            switch (danmu.mode) {
                case 0:
                    danmu.$ref.style.transform = `translateX(${-danmu.$restWidth}px) translateY(0px) translateZ(0px)`;
                    danmu.$ref.style.transition = `transform ${danmu.$restTime}s linear 0s`;
                    break;
                default:
                    break;
            }
        });
        return this;
    }

    suspend() {
        const { $player } = this.art.template;
        this.filter('emit', (danmu) => {
            danmu.$state = 'stop';
            danmu.$ref.dataset.state = 'stop';
            switch (danmu.mode) {
                case 0: {
                    const { left: playerLeft, width: playerWidth } = this.getRect($player);
                    const { left: danmuLeft } = this.getRect(danmu.$ref);
                    const translateX = playerWidth - (danmuLeft - playerLeft);
                    danmu.$ref.style.transform = `translateX(${-translateX}px) translateY(0px) translateZ(0px)`;
                    danmu.$ref.style.transition = 'transform 0s linear 0s';
                    break;
                }
                default:
                    break;
            }
        });
        return this;
    }

    resize() {
        const { $player } = this.art.template;
        const danmuLeft = this.getRect($player, 'width');
        this.filter('wait', (danmu) => {
            if (danmu.$ref) {
                danmu.$ref.style.border = 'none';
                danmu.$ref.style.left = `${danmuLeft}px`;
                danmu.$ref.style.marginLeft = '0px';
                danmu.$ref.style.transform = 'translateX(0px) translateY(0px) translateZ(0px)';
                danmu.$ref.style.transition = 'transform 0s linear 0s';
            }
        });
        return this;
    }

    update() {
        const { $player } = this.art.template;
        this.animationFrameTimer = window.requestAnimationFrame(() => {
            if (this.art.playing && !this.isHide) {
                const danmuLeft = this.getRect($player, 'width');

                this.filter('emit', (danmu) => {
                    danmu.$restTime -= (Date.now() - danmu.$lastStartTime) / 1000;
                    danmu.$lastStartTime = Date.now();
                    if (danmu.$restTime <= 0) {
                        danmu.$state = 'wait';
                        danmu.$ref.dataset.state = 'wait';
                        danmu.$ref.style.border = 'none';
                        danmu.$ref.style.left = `${danmuLeft}px`;
                        danmu.$ref.style.marginLeft = '0px';
                        danmu.$ref.style.transform = 'translateX(0px) translateY(0px) translateZ(0px)';
                        danmu.$ref.style.transition = 'transform 0s linear 0s';
                    }
                });

                this.queue
                    .filter(
                        (danmu) =>
                            this.art.currentTime + 0.1 >= danmu.time &&
                            danmu.time >= this.art.currentTime - 0.1 &&
                            danmu.$state === 'wait',
                    )
                    .forEach((danmu) => {
                        danmu.$ref = this.getDanmuRef(this.queue);
                        danmu.$ref.__danmu__ = danmu;
                        this.$danmuku.appendChild(danmu.$ref);
                        danmu.$ref.style.opacity = this.option.opacity;
                        danmu.$ref.style.fontSize = `${this.option.fontSize}px`;
                        danmu.$ref.innerText = danmu.text;
                        danmu.$ref.style.color = danmu.color || '#fff';
                        danmu.$ref.style.border = danmu.border ? `1px solid ${danmu.color || '#fff'}` : 'none';
                        danmu.$restTime =
                            this.option.synchronousPlayback && this.art.playbackRate
                                ? this.option.speed / Number(this.art.playbackRate)
                                : this.option.speed;
                        danmu.$lastStartTime = Date.now();
                        const danmuWidth = this.getRect(danmu.$ref, 'width');
                        const danmuTop = getDanmuTop(this, danmu);
                        danmu.$state = 'emit';
                        danmu.$ref.dataset.state = 'emit';
                        switch (danmu.mode) {
                            case 0: {
                                danmu.$restWidth = danmuLeft + danmuWidth;
                                danmu.$ref.style.left = `${danmuLeft}px`;
                                danmu.$ref.style.top = `${danmuTop}px`;
                                danmu.$ref.style.transform = `translateX(${-danmu.$restWidth}px) translateY(0px) translateZ(0px)`;
                                danmu.$ref.style.transition = `transform ${danmu.$restTime}s linear 0s`;
                                break;
                            }
                            case 1:
                                danmu.$ref.style.top = `${danmuTop}px`;
                                danmu.$ref.style.left = '50%';
                                danmu.$ref.style.marginLeft = `-${danmuWidth / 2}px`;
                                break;
                            default:
                                break;
                        }
                    });
            }

            if (!this.isStop) {
                this.update();
            }
        });
        return this;
    }

    stop() {
        this.isStop = true;
        this.suspend();
        window.cancelAnimationFrame(this.animationFrameTimer);
        this.art.emit('artplayerPluginDanmuku:stop');
        return this;
    }

    start() {
        this.isStop = false;
        this.continue();
        this.update();
        this.art.emit('artplayerPluginDanmuku:start');
        return this;
    }

    show() {
        this.isHide = false;
        this.$danmuku.style.display = 'block';
        this.art.emit('artplayerPluginDanmuku:show');
        return this;
    }

    hide() {
        this.isHide = true;
        this.$danmuku.style.display = 'none';
        this.art.emit('artplayerPluginDanmuku:hide');
        return this;
    }

    emit(danmu) {
        this.validator(danmu, {
            text: 'string',
            mode: 'number|undefined',
            color: 'string|undefined',
            time: 'number|undefined',
            border: 'boolean|undefined',
        });

        if (!danmu.text.trim()) return this;
        if (danmu.text.length > this.option.maxlength) return this;

        if (danmu.time) {
            danmu.time = this.utils.clamp(danmu.time, 0, Infinity);
        } else {
            danmu.time = this.art.currentTime + 0.5;
        }

        this.queue.push({
            mode: 0,
            ...danmu,
            $state: 'wait',
            $ref: null,
            $restTime: 0,
            $lastStartTime: 0,
            $restWidth: 0,
        });

        return this;
    }
}

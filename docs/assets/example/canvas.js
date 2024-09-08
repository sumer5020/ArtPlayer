// npm i artplayer-proxy-canvas
// import artplayerProxyCanvas from 'artplayer-proxy-canvas';

var art = new Artplayer({
    container: '.artplayer-app',
    url: '/assets/sample/frag_bunny.mp4',
    volume: 0.5,
    autoplay: false,
    autoSize: false,
    screenshot: true,
    setting: true,
    loop: true,
    flip: true,
    playbackRate: true,
    aspectRatio: true,
    fullscreen: true,
    fullscreenWeb: true,
    miniProgressBar: true,
    autoPlayback: true,
    thumbnails: {
        url: '/assets/sample/bbb-sprite.jpg',
        number: 121,
        column: 11,
        width: 128,
        height: 72,
    },
    proxy: artplayerProxyCanvas(),
});
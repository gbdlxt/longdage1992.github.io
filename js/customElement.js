/*----------------------------------------*
 *                                        *
 *            Custom components           *
 *                                        *
 *----------------------------------------*/
class LgaMedia extends HTMLElement {
    constructor(options) {
        super();
        this.initParas(options);
        this.genarateDom();
    }

    initParas(options) {
        if(options) {
            for(let p in options) {
                this[p] = options[p];
            }
        }
    }

    genarateDom() {
        this.className = 'lga-media';
        this.id = `stream_${this.streamID}`;
        this.innerHTML = `
            <video class="lga-media-video" autoplay playsinline controls ${this.muted? 'muted': ''}></video>
            <div class="lga-media-info">${this.userName}</div>
            <div class="lga-media-quality"></div>
        `;
        this.video = this.querySelector('.lga-media-video');
        this.quality = this.querySelector('.lga-media-quality');
        if(this.srcObject) {
            this.video.srcObject = this.srcObject;
        }
    }

    setQuality(quality) {
        console.log(quality);
        this.quality.innerHTML = `
                <p><strong>${quality.type}</strong></p>
                <p><strong>延时(ms):</strong>${quality.currentRoundTripTime}</p>
                <p><strong>分辨率:</strong>${quality.frameWidth}x${quality.frameHeight}</p>
                <p><strong>音频帧率(fps):</strong>${quality.audioFPS}</p>
                <p><strong>音频码率(kbps):</strong>${quality.audioBitrate}</p>
                <p><strong>音频丢包率(%):</strong>${quality.audioPacketsLostRate}</p>
                <p><strong>视频帧率(fps):</strong>${quality.videoFPS}</p>
                <p><strong>视频码率(kbps):</strong>${quality.videoBitrate}</p>
                <p><strong>视频丢包率(%):</strong>${quality.videoPacketsLostRate}</p>
        `;
    }
    // setInfo(info) {
    //     console.log(info);
    //     this.info.textContent = info;
    // }

    getVideoElement() {
        return this.video;
    }
}
customElements.define('lga-media', LgaMedia);
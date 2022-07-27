/*----------------------------------------*
 *                                        *
 *            Custom components           *
 *                                        *
 *----------------------------------------*/
class LgaMedia extends HTMLElement {
    // optins: {streamID, userName, userID, srcObject: Stream, muted, address, operator, src}
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

    // 生成流的渲染节点
    genarateDom() {
        this.className = 'lga-media';
        this.id = `stream_${this.streamID}`;
        this.innerHTML = `
            <video class="lga-media-video" crossorigin="anonymous" autoplay loop playsinline controls ${this.muted? 'muted': ''}></video>
            <div class="lga-media-info">${this.userName}</div>
            <div class="lga-media-quality"></div>
        `;
        this.video = this.querySelector('.lga-media-video');
        this.quality = this.querySelector('.lga-media-quality');
        console.log('srcObject', this.srcObject);
        if(this.srcObject) {
            this.video.srcObject = this.srcObject;
        }else {
            // this.video.src = '/custom.mp4';
            this.video.src = this.streamType;
        }
    }
    
    // 质量数据插入流渲染节点的<div class="lga-media-quality"></div>里
    setQuality(quality) {
        console.log(quality);
        this.quality.innerHTML = `
                <p><strong>${quality.type}</strong></p>
                <p><strong>延时(ms):</strong>${quality.currentRoundTripTime}</p>
                <p><strong>分辨率:</strong>${quality.frameWidth}x${quality.frameHeight}</p>
                <p><strong>视频帧率(fps):</strong>${quality.videoFPS}</p>
                <p><strong>视频码率(kbps):</strong>${quality.videoBitrate}</p>
                <p><strong>视频丢包率(%):</strong>${quality.videoPacketsLostRate}</p>
                <p><strong>地理位置:</strong>${this.address}</p>
                <p><strong>运营商:</strong>${this.operator}</p>
        `;
    }

    getVideo() {
        return this.video;
    }
}

customElements.define('lga-media', LgaMedia);
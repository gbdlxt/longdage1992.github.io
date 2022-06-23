const lingoAce = (function() {
    let appID = 2126428027;
    let server = 'wss://webliveroom2126428027-api.zego.im/ws';
    let userID = new Date().getTime().toString(); // userID 用户自己设置，必须保证全局唯一
    let userName = userID;// userName 用户自己设置，没有唯一性要求
    let roomID = userID; // roomID 用户自己设置，必须保证全局唯一
    let renderSelector = '';
    let zg = new ZegoExpressEngine(appID, server);;
    let hasInit = false; // 标识是否初始化，防止重复绑定事件
    let localStream; // 本地流
    let localStreamID; // 本地流ID

    // 创建流的约束
    let audioBitrate = 48;
    let frameBitrate = 400;
    let frameFPS = 15;
    let frameHeight = 64;
    let frameWidth = 320;
    let videoInput = 'default';
    let audioInput = 'default';

    // 设置日志级别
    const config = {
        logLevel: 'report',
        remoteLogLevel: 'report',
        logURL: ''
    };
    zg.setLogConfig(config);

    // 缓存播放器数据
    let mediaModal = proxyModal();

    // 利用代理，增加、删除mediaModal时，自动更新DOM
    function proxyModal() {
        return new Proxy({}, {
            set: (target, key, value, receiver)=> {
                //排除数组修改length回调
                if (!(Array.isArray(target) && key === 'length')) {
                    console.log(target, key, value, receiver);
                    //新增流，更新dom
                    document.querySelector(renderSelector).appendChild(value);
                }
                return Reflect.set(target, key, value, receiver);
            },
            deleteProperty: (target, property)=> {
                console.log(target, property);
                // 删除流 更新DOM
                document.querySelector(`#${property}`).remove();
            }
        });
    }

    function bindRoomStateUpdate() {
        zg.on('roomStateUpdate', async (roomID, state, errorCode, extendedData) => {
            console.warn('[roomStateUpdate]', roomID, state, errorCode, extendedData);
            if(!errorCode) {
                if (state == 'CONNECTED') {
                    const constraints = {
                        camera: {
                            audio: true, 
                            video: true,
                            videoQuality: 4,
                            audioBitrate,
                            width: frameWidth,
                            height: frameHeight,
                            bitrate: frameBitrate,
                            frameRate: frameFPS,
                            videoInput,
                            audioInput,
                            videoOptimizationMode: 'motion' //motion、detail； motion：流畅优先，在大多数情况下，SDK 不会降低帧率，但是可能会降低发送分辨率
                        }
                    }
                    console.warn('[roomStateUpdate]', constraints);
                    localStream = await zg.createStream(constraints);
                    localStreamID = `${new Date().getTime().toString()}`;
                    const muted = true; // 本地流静音
                    const lgaMedia = new LgaMedia({streamID: localStreamID, userName, userID, srcObject: localStream, muted});
                    mediaModal[`stream_${localStreamID}`] = lgaMedia;
                    
                    zg.startPublishingStream(localStreamID, localStream);
                } //state == 'CONNECTING' 、'DISCONNECTED'
            }else {
                //各种异常处理
            }
        });
    }
    
    function bindRoomStreamUpdate() {
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList, extendedData) => {
            console.warn('[roomStreamUpdate]', roomID, updateType, streamList, extendedData)
            if (updateType == 'ADD') {
                streamList.forEach(async item=> {
                    const streamID = item.streamID;
                    // if(streamID.indexOf('stream_') === -1 ) { return; } // 排除探测流
                    const remoteStream = await zg.startPlayingStream(streamID);
                    const {userName, userID } = item.user;
                    const lgaMedia = new LgaMedia({streamID, userName, userID, srcObject: remoteStream});
                    mediaModal[`stream_${streamID}`] = lgaMedia;
                });
            } else if (updateType == 'DELETE') {
                console.error('[roomStreamUpdate]', streamList);
                const streamID = streamList[0].streamID;
                zg.stopPlayingStream(streamID);
                delete mediaModal[`stream_${streamID}`];
            }
        });
    }
    
    function bindPublishQualityUpdate () {
        zg.on('publishQualityUpdate', (streamID, stats)=> {
            console.warn('publishQualityUpdate', streamID, stats);
            const quality = getQualityData(stats, '推流质量');
            mediaModal[`stream_${streamID}`].setQuality(quality);
        });
        
    }
    
    function bindPlayQualityUpdate() {
        zg.on('playQualityUpdate', (streamID, stats)=> {
            console.warn('playQualityUpdate', streamID, stats);
            const quality = getQualityData(stats, '拉流质量');
            mediaModal[`stream_${streamID}`].setQuality(quality);
        });
    }

    function getQualityData(stats, type) {
        return {
            type,
            currentRoundTripTime: +stats.currentRoundTripTime * 1000, //rtt 是从浏览器发送请求到收到服务器响应的持续时间，以毫秒为单位
            audioFPS: Math.round(+stats.audio.audioFPS * 100) / 100, // 音频帧率
            audioBitrate: Math.round(+stats.audio.audioBitrate * 100) / 100, // 音频码率
            audioPacketsLostRate: Math.round(+stats.audio.audioPacketsLostRate * 100) / 100, // 音频丢包率
            videoFPS: Math.round(+stats.video.videoFPS * 100) / 100, // 视频帧率
            videoBitrate: Math.round(+stats.video.videoBitrate * 100) / 100, // 视频码率
            videoPacketsLostRate: Math.round(+stats.video.videoPacketsLostRate * 100) / 100, // 视频丢包率
            frameHeight: stats.video.frameHeight,
            frameWidth: stats.video.frameWidth,
        };
    }
    
    // options: {appID, server, userID, userName, roomID, renderSelector}
    function initClass(options) {
        setConfig(options);
        if(hasInit) { 
            return; 
        } // 已经被初始化了
        hasInit = true;
        // zg = new ZegoExpressEngine(appID, server);
        bindRoomStateUpdate();
        bindRoomStreamUpdate();
        bindPublishQualityUpdate();
        bindPlayQualityUpdate();
        return zg;
    };

    function setConfig(options) {
        console.log('[setConfig]', options);
        renderSelector = options.renderSelector;
        roomID = options.roomID;
        userName = options.userName;
        userID = options.userID
        audioBitrate = +options.audioBitrate;
        frameBitrate = +options.frameBitrate;
        frameFPS = +options.frameFPS;
        frameHeight = +options.frameHeight;
        frameWidth = +options.frameWidth;
        videoInput = options.videoInput;
        audioInput = options.audioInput;
    }

    async function loginClass() {
        return new Promise(resolve=> {
            fetch(`https://wsliveroom-alpha.zego.im:8282/token?app_id=${appID}&id_name=${userID}`)
            .then(rsp=> rsp.text())
            .then(token=> {
                zg.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }).then(rsp=> {
                    resolve(rsp);
                }).catch(e=> resolve(false));
            });
        });
    };

    function logoutClass() {
        console.warn(localStreamID);
        if(localStreamID) {
            zg.stopPublishingStream(localStreamID);
            zg.destroyStream(localStream);
        }
        zg.logoutRoom(roomID);
        mediaModal = proxyModal();
        renderSelector
            ? document.querySelector(renderSelector).innerHTML = ''
            : '';
        console.warn(localStreamID, mediaModal);
    }

    return {
        initClass, // 初始化课堂，配置赋值，事件绑定
        loginClass,
        logoutClass,
        zg
    };
})();

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

    // 创建流的约束变量
    let audioBitrate = 48;
    let frameBitrate = 400;
    let frameFPS = 15;
    let frameHeight = 64;
    let frameWidth = 320;
    let videoInput = 'default';
    let audioInput = 'default';

    // 流附加地理位置、运营商
    let address = ''; // 地理位置
    let operator = ''; // 运营商
    let streamType = ''; // camera、custom.标识推音视频流、者第三方推流(mp4)

    // 设置日志级别
    const config = {
        logLevel: 'report',
        remoteLogLevel: 'report',
        logURL: ''
    };
    zg.setLogConfig(config);

    // 缓存播放器数据 {stream_${streamID}: LgaMedia}
    let mediaModal = proxyModal();

    // 利用代理，增加、删除mediaModal时，自动更新流的渲染DOM。(与mvvm双向绑定机制一致)
    function proxyModal() {
        return new Proxy({}, {
            set: (target, key, value, receiver)=> {
                //排除数组修改length回调
                if (!(Array.isArray(target) && key === 'length')) {
                    console.log(target, key, value, receiver);
                    //新增流，更新dom
                    const container = document.querySelector(renderSelector);
                    const firstChild = container.firstChild;
                    if(value.id == `stream_${localStreamID}` && firstChild) { // 推流放在第一位
                        container.insertBefore(value, firstChild);
                    }else {
                        container.appendChild(value);
                    }
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

    // 监听房间状态变化事件
    function bindRoomStateUpdate() {
        zg.on('roomStateUpdate', async (roomID, state, errorCode, extendedData) => {
            console.warn('[roomStateUpdate]', roomID, state, errorCode, extendedData);
            if(!errorCode) {
                if (state == 'CONNECTED') {
                    if(localStreamID) { return }// 网络波动，重新连接不要再创建流
                    // 创建音视频流
                    // let srcObject = '';
                    if(streamType == 'camera') {
                        localStream = null;
                        localStream = await zg.createStream({
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
                        });// 本地流，保存到外层，方便退出等操作时销毁
                    }
                    localStreamID = `${new Date().getTime().toString()}`; // 本地流ID，保存到外层，方便退出等操作时销毁
                    const muted = true; // 本地流静音 防回采产生的啸音
                    const publishOption = {extraInfo: JSON.stringify({address, operator})}; //流附加信息，附加了地理位置和运营商
                    const lgaMedia = new LgaMedia({
                        streamID: localStreamID, 
                        userName, 
                        userID, 
                        srcObject: localStream? localStream: '', // 没有流，则播放内置mp4
                        muted, 
                        address, 
                        operator,
                        streamType
                    });
                    mediaModal[`stream_${localStreamID}`] = lgaMedia;
                    
                    // 创建第三方流
                    if(streamType != 'camera') {
                        const source = lgaMedia.getVideo();
                        source.onplay = async ()=> {
                            localStream = await zg.createStream({
                                custom: {
                                    source,
                                    bitrate: frameBitrate,
                                    audioBitrate,
                                    videoOptimizationMode: 'motion' //motion、detail； motion：流畅优先，在大多数情况下，SDK 不会降低帧率，但是可能会降低发送分辨率      
                                }
                            }); 
                            zg.startPublishingStream(localStreamID, localStream, publishOption);
                        }
                    }else {
                        zg.startPublishingStream(localStreamID, localStream, publishOption);
                    }
                    
                } //state == 'CONNECTING' 、'DISCONNECTED'
            }else {
                //各种异常处理
            }
        });
    }
    
    let firstFPSFlag = false;
    // 监听流变化事件
    function bindRoomStreamUpdate() {
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList, extendedData) => {
            console.warn('[roomStreamUpdate]', roomID, updateType, streamList, extendedData)
            if (updateType == 'ADD') {
                streamList.forEach(async item=> {
                    const streamID = item.streamID;
                    // NOTE 计算首帧时间
                    let firstFPSDate = 0;
                    if(!firstFPSFlag) {
                        firstFPSDate = new Date().getTime();
                    }
                    const remoteStream = await zg.startPlayingStream(streamID);
                    // NOTE 计算首帧时间
                    if(!firstFPSFlag) {
                        let duration = new Date().getTime() - firstFPSDate;
                        firstFPSFlag = true;
                        statistics.post({
                            "event": "FIRST_FPS_ELAPSED",
                            "localTs": new Date().getTime(),
                            "duration": duration,
                        });
                    }
                    const {userName, userID } = item.user;
                    const {address, operator} = item.extraInfo? JSON.parse(item.extraInfo): {};
                    const lgaMedia = new LgaMedia({streamID, userName, userID, srcObject: remoteStream, address, operator});
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
    
    // 监听推流质量事件
    function bindPublishQualityUpdate () {
        zg.on('publishQualityUpdate', (streamID, stats)=> {
            console.warn('publishQualityUpdate', streamID, stats);
            const quality = getQualityData(stats, '推流质量');
            mediaModal[`stream_${streamID}`].setQuality(quality);
            // NOTE 推流质量上报
            statistics.post({
                "event": "QOE",
                "localTs": new Date().getTime(),
                "res": `${quality.frameWidth}x${quality.frameHeight}`,
                "vfps": quality.videoFPS,
                "vra": quality.videoBitrate,
                "totalVideoDuration": mediaModal[`stream_${streamID}`].getVideo().currentTime,
                "videoCatonRate": 0,
                "totalAudioDuration": mediaModal[`stream_${streamID}`].getVideo().currentTime,
                "audioCatonRate": 0,
                "rtt": quality.currentRoundTripTime,
                "pktLostRate": quality.videoPacketsLostRate,
                // "dktLostRate": 0,
                "duration": 0
            });
        });
    }
    
    // 监听拉流质量事件
    function bindPlayQualityUpdate() {
        zg.on('playQualityUpdate', (streamID, stats)=> {
            console.warn('playQualityUpdate', streamID, stats);
            const quality = getQualityData(stats, '拉流质量');
            mediaModal[`stream_${streamID}`].setQuality(quality);
            statistics.post({
                "event": "QOE",
                "localTs": new Date().getTime(),
                "res": `${quality.frameWidth}x${quality.frameHeight}`,
                "vfps": quality.videoFPS,
                "vra": quality.videoBitrate,
                "totalVideoDuration": mediaModal[`stream_${streamID}`].getVideo().currentTime,
                "videoCatonRate": 0,
                "totalAudioDuration": mediaModal[`stream_${streamID}`].getVideo().currentTime,
                "audioCatonRate": 0,
                "rtt": quality.currentRoundTripTime,
                // "pktLostRate": 0,
                "dktLostRate": quality.videoPacketsLostRate,
                "duration": 0
            });
        });
    }

    // 将质量数据提炼出需要展示的数据； stats: 质量数据，type：推流质量|拉流质量
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
    
    // 初始化课堂，初始化流约束条件，以及绑定事件
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

    // 界面上视频流各种约束条件赋值
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
        address = options.address;
        operator = options.operator;
        streamType = options.streamType;
    }

    // 登录房间 获取token再登录房间
    async function loginClass() {
        return new Promise(resolve=> {
            fetch(`https://wsliveroom-alpha.zego.im:8282/token?app_id=${appID}&id_name=${userID}`)
            .then(rsp=> rsp.text())
            .then(token=> {
                // NOTE 开始进入房间上报日志
                let beginLoginTime = new Date().getTime();
                statistics.post({
                    "event": "JOIN",
                    "localTs": beginLoginTime
                });
                zg.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }).then(rsp=> {
                    // NOTE 进入房间成功上报日志
                    let successTime = new Date().getTime(); 
                    statistics.post({
                        "event": "JOIN_OK",
                        "localTs": successTime,
                        "duration": successTime - beginLoginTime
                    });
                    resolve(rsp);
                }).catch(e=> {
                    let failTime = new Date().getTime(); 
                    statistics.post({
                        "event": "JOIN_FAIL",
                        "localTs": failTime,
                        "duration": failTime - beginLoginTime
                    });
                    resolve(false);
                });
            });
        });
    };

    // 登出房间 本地流资源释放、登出房间后还要把流渲染DOM清空
    function logoutClass() {
        console.warn(localStreamID);
        if(localStreamID) {
            zg.stopPublishingStream(localStreamID);
            zg.destroyStream(localStream);
            localStreamID = '';
            localStream = null;
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

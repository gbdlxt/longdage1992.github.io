const statistics = (function() {
    // 日志参数
    const lingoLogPath = 'https://datatransfer.lingoace.com/api/v1/data-transfer/3rd/up?key=TFxVjBmLx9aivXB3yxE';

    let commonData = {
        "roomId": 100101,
        "event": "JOIN",
        "localTs": 1657782561295,
        "userId": 33333,
        "userName": "jack",
        "duration": 0,  
        "ip": "127.0.0.1",  // rtc 候选获取
        "country": "中国",  // 输入
        "province": "北京", // 输入
        "city": "北京", // 输入
        "isp": "中国移动", // 输入
        "net": null, 
        "app": 1,
        "model": "iPhone Xs Max",
        "ua": "",
        "audioInput": "本地音频",
        "videoInput": "本地摄像头"
    };

    async function initStatistics(paras) {
        setIp();
        commonData['roomId'] = paras.roomID;
        commonData['userId'] = paras.userID;
        commonData['userName'] = paras.userName;
        try {
            let address = paras.address.split('/');
            commonData['country'] = address[0];
            commonData['province'] = address[1];
            commonData['city'] = address[2];
        } catch(e) {}
        commonData['isp'] = paras.operator;
        commonData['app'] = 2126428027;
        commonData['model'] = navigator.userAgent.match(/\(.*?\)/g)[0].slice(1, -1);
        commonData['ua'] = navigator.userAgent;
        commonData['audioInput'] = paras.audioInputName;
        commonData['videoInput'] = paras.videoInputName;

        console.log('[initStatistics]', commonData);
    }

    function setIp() {
        getIp().then(rsp=> {
            commonData['ip'] = rsp;
        }).catch(err=> {
            commonData['ip'] = null;
        });
    }

    async function getIp() {
        return new Promise((resolve)=> {
            if(typeof window != 'undefined'){
                var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
                if (RTCPeerConnection) {
                    (()=>{
                        var rtc = new RTCPeerConnection();
                        rtc.createDataChannel(''); //创建一个可以发送任意数据的数据通道
                        rtc.createOffer( offerDesc => { //创建并存储一个sdp数据
                            rtc.setLocalDescription(offerDesc);
                        }, e => {
                            console.error("[getIp] sdp创建失败");
                            resolve(null);
                        });
                        rtc.onicecandidate =(evt) => { //监听candidate事件
                            if (evt.candidate) {
                                console.log('[getIp]',evt.candidate);
                                let ip_rule = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/;
                                var ip_addr = ip_rule.exec(evt.candidate.candidate)[1];
                                console.log('[getIp]',ip_addr)   //打印获取的IP地址
                                resolve(ip_addr);
                            }
                        }
                    })();
                }else {
                    console.error("[getIp] 没有找到ip地址");
                    resolve(null);
                }
            }
        });
    }

    function post(paras) {
        if(commonData.app === 1) { return }// 简单处理，连通性检测，会登录。此处不要报
        let data = Object.assign({}, commonData, paras);
        console.log(`[${data.event}]`, data);
        fetch(lingoLogPath, {
            body: JSON.stringify(data),
            method: 'POST',
            headers: {
                'content-type': 'application/json'
              }
        }).then(rsp=> {
            console.log(rsp);
        }).catch(err=> {
            console.error(err);
        });
    }

    return {
        initStatistics,
        post
    };
})();
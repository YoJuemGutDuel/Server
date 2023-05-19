import redis from 'redis';
import CryptoJS from 'crypto-js';
import fetch from 'node-fetch';
import redisCli from './redis.js';
import config from '../config/index.js';

const create4DigitCode = () => {
    const code = Math.floor(Math.random() * 9000) + 1000;
    return code.toString();
};

const saveAuthCode = async (tel, code) => {
    await redisCli.set(tel, code, { EX: 180});
};

const compareAuthCode = async (tel, code) => {
    const result = await redisCli.get(tel);
    console.log("redis", result, "code", code);

    if (code == result) {
        await redisCli.del(tel);
        return true;
    } else {
        return false;
    }
};


const sendMessageWithAuth = async (tel, code) => {
    try{
        const timestamp = Date.now().toString();
        const method = "POST";
        const space = " ";
        const newLine = "\n";
        const urlSub = `/sms/v2/services/${config.serviceId}/messages`;
        const url = `https://sens.apigw.ntruss.com/sms/v2/services/${config.serviceId}/messages`;

        //x-ncp-apigw-signature-v2 
        //Body를 Access Key Id와 맵핑되는 SecretKey로 암호화한 서명. HMAC 암호화 알고리즘은 HmacSHA256 사용
        const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, config.secretKey);
        hmac.update(method);
        hmac.update(space);
        hmac.update(urlSub);
        hmac.update(newLine);
        hmac.update(timestamp);
        hmac.update(newLine);
        hmac.update(config.accessKey);
        const hash = hmac.finalize();
        const signature = hash.toString(CryptoJS.enc.Base64);

        const body = JSON.stringify({ //json 문자열로 변환
            type: "SMS",
            countryCode: "82",
            from: config.phoneNumber,
            content: `인증번호: ${code}`,
            messages: [{to: tel}],
        });

        const response = await fetch(url,
            {
                method: method,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "x-ncp-apigw-timestamp": timestamp,
                    "x-ncp-iam-access-key": config.accessKey,
                    "x-ncp-apigw-signature-v2": signature,
                },
                body: body,
            }
        );

        const result = await response.json();
        if(result.statusCode === "202"){
            return true; //문자 전송 성공
        }else{
            return false; //문자 전송 실패
        }

    }catch(error){
        throw error;
    }
}

export {
    create4DigitCode,
    saveAuthCode,
    compareAuthCode,
    sendMessageWithAuth,
};

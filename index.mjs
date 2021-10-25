import express from 'express';

import fetch from 'node-fetch';
import { Request } from 'node-fetch';
import { Base64 } from 'js-base64'
import { FormData } from 'formdata-node';

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
    try {
        await handlePostRequest(req, res);
    } catch (err) {
        console.log("ERROR - " + err);
    }
});

const port = process.env.PORT ?? 3000;

app.listen(port);

/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handlePostRequest(request, response) {
    const requestBody = request.body;
    if (requestBody.type === "url_verification") {
        const challenge = requestBody.challenge;
        response.send(challenge);

        return;
    }

    const event = requestBody.event;
    if (event.type === "file_shared") {
        const fileId = event.file_id;
        const fileInfo = await getFileInfo(fileId);

        if (fileInfo.file.mimetype.includes("image")) {
            const base64Image = await getBase64Image(fileInfo.file.url_private);
            
            const imageText = await ocr(base64Image);

            if (imageText) {
                const blacklist = ["cafea", "cafeluță", "cafeluta", "savurăm", "savuram", "savurați", "savurati", "savurează", "savureaza", "dimineață", "dimineata", "dimineața", "savoare", "savuros", "savuroasă", "savuroasa", "minunat", "minunată", "minunata"]

                if (blacklist.some(v => imageText.toLowerCase().includes(v))) {
                    console.log(await deleteFile(fileId));
                    const user = event.user_id;

                    console.log(await sendMessage(user));
                }
            }
        }
    }

    response.send(200);
    return;
}

async function getFileInfo(fileId) {
    const formData = new FormData();
    formData.append("file", fileId);

    const fileInfoRequest = new Request("https://slack.com/api/files.info", {
        headers: {
            "Authorization": "Bearer " + process.env.SLACK_USER_TOKEN
        },
        body: formData,
        method: "POST",
    });

    let fileInfoRes = await fetch(fileInfoRequest);

    return await fileInfoRes.json();
}

async function deleteFile(fileId) {
    const formData = new FormData();
    formData.append("file", fileId);

    const fileDeleteRequest = new Request("https://slack.com/api/files.delete", {
        headers: {
            "Authorization": "Bearer " + process.env.SLACK_USER_TOKEN
        },
        body: formData,
        method: "POST",
    });

    let fileDeleteRes = await fetch(fileDeleteRequest);
    return await fileDeleteRes.json();
}

async function getBase64Image(photoUrl) {
    const fileDownloadRequest = new Request(photoUrl, {
        headers: {
            "Authorization": "Bearer " + process.env.SLACK_USER_TOKEN
        },
        method: "GET",
    });

    const fileDownloadResponse = await fetch(fileDownloadRequest);

    return Base64.fromUint8Array(await fileDownloadResponse.arrayBuffer());
}

async function ocr(base64Image) {
    const url = "https://vision.googleapis.com/v1/images:annotate?key=" + process.env.VISION_API_KEY;
    const body = {
        requests: [
            {
                image: {
                    content: base64Image
                },
                features: [
                    {
                        type: "TEXT_DETECTION"
                    }
                ],
                imageContext: {
                    languageHints: ["ro"]
                }
            }
        ]
    }

    const request = new Request(url, {
        body: JSON.stringify(body),
        method: 'POST'
    });

    const res = await fetch(request);
    const responseBody = await res.json();

    if (responseBody.responses.length != 0) {
        return responseBody.responses[0].fullTextAnnotation.text
    }

    return ""
}

async function sendMessage(channel) {
    const formData = new FormData();
    formData.append("channel", channel);
    formData.append("text", "https://youtu.be/l60MnDJklnM");

    const sendMessageRequest = new Request("https://slack.com/api/chat.postMessage", {
        headers: {
            "Authorization": "Bearer " + process.env.SLACK_BOT_TOKEN
        },
        body: formData,
        method: "POST",
    });

    let sendMessageResponse = await fetch(sendMessageRequest);
    return await sendMessageResponse.json();
}

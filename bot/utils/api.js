const fetch = require('node-fetch');

async function postToDjango(path, payload, apiBaseUrl, apiSecret) {
    const makeUrl = (base) => `${base.replace(/\/$/, '')}${path}`;

    const attemptFetch = async(url) => {
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiSecret,
            },
            body: JSON.stringify(payload),
        });
    };

    const primaryUrl = makeUrl(apiBaseUrl);

    let response;
    try {
        response = await attemptFetch(primaryUrl);
    } catch (err) {
        // If HTTPS to localhost fails due to TLS issues, retry over plain HTTP
        const isLocalHttps = primaryUrl.startsWith('https://') && /https:\/\/127\.0\.0\.1|https:\/\/localhost/.test(primaryUrl);
        if (isLocalHttps) {
            const fallback = primaryUrl.replace(/^https:\/\//i, 'http://');
            console.warn('postToDjango: HTTPS to localhost failed, retrying over HTTP:', primaryUrl, '->', fallback, err.message);
            try {
                response = await attemptFetch(fallback);
            } catch (err2) {
                // rethrow original for context
                err2.requestUrl = primaryUrl;
                throw err2;
            }
        } else {
            err.requestUrl = primaryUrl;
            throw err;
        }
    }

    // Try to parse JSON, but if parsing fails capture raw text for debugging
    let data = null;
    let rawText = null;
    try {
        data = await response.json();
    } catch (err) {
        try {
            rawText = await response.text();
        } catch (e) {
            rawText = null;
        }
        data = {};
    }

    if (!response.ok) {
        const serverMessage = data && data.error ? data.error : rawText ? rawText : `Request failed with status ${response.status}`;
        const err = new Error(serverMessage);
        err.status = response.status;
        err.responseBody = data && Object.keys(data).length ? data : rawText;
        err.requestUrl = url;
        try {
            const headersObj = {};
            response.headers.forEach((v, k) => { headersObj[k] = v });
            console.error('postToDjango non-OK response', {
                url,
                status: response.status,
                headers: headersObj,
                body: err.responseBody,
            });
        } catch (e) {
            console.error('postToDjango failed to log response details', e.message);
        }
        throw err;
    }

    return data;
}

module.exports = {
    postToDjango,
};
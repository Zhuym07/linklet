// shortenurl.js
document.addEventListener('DOMContentLoaded', function() {
    // Get the URL of the current script
    const scriptElement = document.currentScript;
    const scriptUrl = scriptElement.src ? new URL(scriptElement.src) : null;
    const baseUrl = scriptUrl.origin;

    const button = document.createElement('button');
    button.textContent = 'Generate Short URL and Copy';
    button.id = 'shortenBtn';
    document.body.appendChild(button);

    const message = document.createElement('p');
    message.id = 'message';
    document.body.appendChild(message);

    button.addEventListener('click', function() {
        fetch(`${baseUrl}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: window.location.href })
        })
        .then(response => response.json())
        .then(data => {
            const shortUrl = `${baseUrl}/${data.shortUrl}`;
            navigator.clipboard.writeText(shortUrl).then(() => {
                message.textContent = 'Short URL copied: ' + shortUrl;
            }).catch(() => {
                message.textContent = 'Copy failed: ' + shortUrl;
            });
        })
        .catch(() => {
            message.textContent = 'Failed to generate short URL';
        });
    });
});
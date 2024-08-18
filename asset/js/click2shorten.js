// shortenurl.js
document.addEventListener('DOMContentLoaded', function() {
    // 获取当前脚本的URL
    const scriptElement = document.currentScript;
    const scriptUrl = new URL(scriptElement.src);
    const baseUrl = scriptUrl.origin;

    const button = document.createElement('button');
    button.textContent = '生成短网址并复制';
    button.id = 'shortenBtn';
    document.body.appendChild(button);

    const message = document.createElement('p');
    message.id = 'message';
    document.body.appendChild(message);

    button.addEventListener('click', function() {
        fetch(`${baseUrl}/create`, {  // 动态构建请求URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: window.location.href })
        })
        .then(response => response.json())
        .then(data => {
            const shortUrl = `${baseUrl}/${data.shortUrl}`;
            navigator.clipboard.writeText(shortUrl).then(() => {
                message.textContent = '短链接已复制: ' + shortUrl;
            }).catch(() => {
                message.textContent = '复制失败: ' + shortUrl;
            });
        })
        .catch(() => {
            message.textContent = '生成短链接失败';
        });
    });
});

const timedata = new Date();
const formattedDate = new Intl.DateTimeFormat('zh-CN', options).format(timedata);

const slug = params.id;

const Url = await env.DB.prepare(`SELECT url FROM links where slug = '${slug}'`).first();

if (!Url) {
    return new Response(page404, {
        status: 404,
        headers: {
            "content-type": "text/html;charset=UTF-8",
        }
    });
} else {
    try {
        // 检查 Referer 是否为 domain.com/js/click2short.js
        if (Referer && Referer.includes('domain.com/js/click2short.js')) {
            const click2shortJs = await fetch('https://example.com/asset/js/click2short.js');
            const jsContent = await click2shortJs.text();
            return new Response(jsContent, {
                status: 200,
                headers: {
                    "content-type": "application/javascript;charset=UTF-8",
                }
            });
        }

        const info = await env.DB.prepare(`INSERT INTO logs (url, slug, ip, referer, ua, create_time) 
        VALUES ('${Url.url}', '${slug}', '${clientIP}', '${Referer}', '${userAgent}', '${formattedDate}')`).run();
        // console.log(info);
        return Response.redirect(Url.url, 302);

    } catch (error) {
        console.log(error);
        return Response.redirect(Url.url, 302);
    }
}
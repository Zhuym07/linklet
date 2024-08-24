/**
 * @api {post} /create Create
 */

// Path: functions/create.js

function generateRandomString(length) {
    const characters = '123456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }

    return result;
}

const whitelist = ['zer0code.cn', 'ckar.xyz', 'bilibili.com', 'b23.tv']; // 白名单域名

function isWhitelisted(hostname) {
    return whitelist.some(domain => {
        const domainParts = domain.split('.').reverse();
        const hostnameParts = hostname.split('.').reverse();

        for (let i = 0; i < domainParts.length; i++) {
            if (domainParts[i] !== hostnameParts[i]) {
                return false;
            }
        }
        return true;
    });
}

export async function onRequest(context) {
    const requestUrl = new URL(context.request.url);
    const referer = context.request.headers.get('referer');
    const refererUrl = referer ? new URL(referer) : null;
    const { url, slug, password: inputPassword } = await context.request.json();
    const password = context.env.PASSWORD; // 从环境变量中读取密码

    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400', // 24小时
            },
        });
    }

    if (!refererUrl) {
        return new Response(JSON.stringify({ message: 'Referer header is missing.' }), {
            status: 403,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    if (!isWhitelisted(refererUrl.hostname)) {
        if (!inputPassword) {
            return new Response(JSON.stringify({ message: 'Password is missing.' }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        if (inputPassword !== password) {
            return new Response(JSON.stringify({ message: 'Incorrect password.' }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    }

    const { request, env } = context;
    const originurl = new URL(request.url);
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP");
    const userAgent = request.headers.get("user-agent");
    const origin = `${originurl.protocol}//${originurl.hostname}`;

    const options = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const timedata = new Date();
    const formattedDate = new Intl.DateTimeFormat('zh-CN', options).format(timedata);
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400', // 24 hours
    };
    if (!url) return Response.json({ message: 'Missing required parameter: url.' });

    // url格式检查
    if (!/^https?:\/\/.{3,}/.test(url)) {
        return Response.json({ message: 'Illegal format: url.' }, {
            headers: corsHeaders,
            status: 400
        });
    }

    // 自定义slug长度检查 2<slug<10 是否不以文件后缀结尾
    if (slug && (slug.length < 2 || slug.length > 10 || /.+\.[a-zA-Z]+$/.test(slug))) {
        return Response.json({ message: 'Illegal length: slug, (>= 2 && <= 10), or not ending with a file extension.' }, {
            headers: corsHeaders,
            status: 400
        });
    }

    try {
        // 如果自定义slug
        if (slug) {
            const existUrl = await env.DB.prepare(`SELECT url as existUrl FROM links where slug = '${slug}'`).first();

            // url & slug 是一样的。
            if (existUrl && existUrl.existUrl === url) {
                return Response.json({ slug, link: `${origin}/${slug}` }, {
                    headers: corsHeaders,
                    status: 200
                });
            }

            // slug 已存在
            if (existUrl) {
                return Response.json({ message: 'Slug already exists.' }, {
                    headers: corsHeaders,
                    status: 200
                });
            }
        }

        // 目标 url 已存在
        const existSlug = await env.DB.prepare(`SELECT slug as existSlug FROM links where url = '${url}'`).first();

        // url 存在且没有自定义 slug
        if (existSlug && !slug) {
            return Response.json({ slug: existSlug.existSlug, link: `${origin}/${existSlug.existSlug}` }, {
                headers: corsHeaders,
                status: 200
            });
        }
        const bodyUrl = new URL(url);

        if (bodyUrl.hostname === originurl.hostname) {
            return Response.json({ message: 'You cannot shorten a link to the same domain.' }, {
                headers: corsHeaders,
                status: 400
            });
        }

        // 生成随机slug
        const slug2 = slug ? slug : generateRandomString(4);

        const info = await env.DB.prepare(`INSERT INTO links (url, slug, ip, status, ua, create_time) 
        VALUES ('${url}', '${slug2}', '${clientIP}',1, '${userAgent}', '${formattedDate}')`).run();

        return Response.json({ slug: slug2, link: `${origin}/${slug2}` }, {
            headers: corsHeaders,
            status: 200
        });
    } catch (e) {
        return Response.json({ message: e.message }, {
            headers: corsHeaders,
            status: 500
        });
    }
}
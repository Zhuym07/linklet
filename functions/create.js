async function verifyTurnstileToken(token, secretKey) {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `secret=${secretKey}&response=${token}`
    });

    const data = await response.json();
    return data.success;
}

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export async function onRequest(context) {
    const { request, env } = context;
    const { url, slug, password: inputPassword, 'cf-turnstile-response': turnstileToken } = await request.json();
    const password = env.PASSWORD; // 从环境变量中读取密码
    const turnstileSecretKey = env.TURNSTILE_SECRET_KEY; // 从环境变量中读取Turnstile密钥

    // 所有创建操作都需要密码验证
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

    // 验证Turnstile Token
    if (!turnstileToken || !(await verifyTurnstileToken(turnstileToken, turnstileSecretKey))) {
        return new Response(JSON.stringify({ message: 'Turnstile verification failed.' }), {
            status: 403,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // 继续处理URL创建逻辑
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
    if (!url) return new Response(JSON.stringify({ message: 'Missing required parameter: url.' }), {
        headers: corsHeaders,
        status: 400
    });

    // url格式检查
    if (!/^https?:\/\/.{3,}/.test(url)) {
        return new Response(JSON.stringify({ message: 'Illegal format: url.' }), {
            headers: corsHeaders,
            status: 400
        });
    }

    // 自定义slug长度检查 2<slug<10 是否不以文件后缀结尾
    if (slug && (slug.length < 2 || slug.length > 10 || /.+\.[a-zA-Z]+$/.test(slug))) {
        return new Response(JSON.stringify({ message: 'Illegal length: slug, (>= 2 && <= 10), or not ending with a file extension.' }), {
            headers: corsHeaders,
            status: 400
        });
    }

    try {
        // 如果自定义slug
        if (slug) {
            const existUrl = await env.DB.prepare('SELECT url as existUrl FROM links WHERE slug = ?').bind(slug).first();

            // url & slug 是一样的。
            if (existUrl && existUrl.existUrl === url) {
                return new Response(JSON.stringify({ slug, link: `${origin}/${slug}` }), {
                    headers: corsHeaders,
                    status: 200
                });
            }

            // slug 已存在
            if (existUrl) {
                return new Response(JSON.stringify({ message: 'Slug already exists.' }), {
                    headers: corsHeaders,
                    status: 200
                });
            }
        }

        // 目标 url 已存在
        const existSlug = await env.DB.prepare('SELECT slug as existSlug FROM links WHERE url = ?').bind(url).first();

        // url 存在且没有自定义 slug
        if (existSlug && !slug) {
            return new Response(JSON.stringify({ slug: existSlug.existSlug, link: `${origin}/${existSlug.existSlug}` }), {
                headers: corsHeaders,
                status: 200
            });
        }
        const bodyUrl = new URL(url);

        if (bodyUrl.hostname === originurl.hostname) {
            return new Response(JSON.stringify({ message: 'You cannot shorten a link to the same domain.' }), {
                headers: corsHeaders,
                status: 400
            });
        }

        // 生成随机slug
        const slug2 = slug ? slug : generateRandomString(4);

        const info = await env.DB.prepare('INSERT INTO links (url, slug, ip, status, ua, create_time) VALUES (?, ?, ?, 1, ?, ?)')
            .bind(url, slug2, clientIP, userAgent, formattedDate).run();

        return new Response(JSON.stringify({ slug: slug2, link: `${origin}/${slug2}` }), {
            headers: corsHeaders,
            status: 200
        });
    } catch (e) {
        return new Response(JSON.stringify({ message: e.message }), {
            headers: corsHeaders,
            status: 500
        });
    }
}
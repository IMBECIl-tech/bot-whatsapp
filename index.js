import 'dotenv/config';
import * as baileys from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import axios from 'axios'; 
import sharp from 'sharp'; 
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Vinculamos el FFmpeg portátil de Node
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// CONFIGURACIÓN DE LAS LLAVES CONECTADAS AL ARCHIVO .ENV (O VARIABLES DE RAILWAY)
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

async function iniciarBot() {
    const { state, saveCreds } = await baileys.useMultiFileAuthState('./bit-nuevo');

    const sock = baileys.default({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Bot-Umamusume', 'Chrome', '1.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) {
            console.log('⚠️ Escanea el código QR en tu WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') console.log('✅ ¡Bot Online! Súper Galería Multimedia V15.0 Activa.');
        if (connection === 'close') {
            console.log('🔄 Conexión perdida. Reconectando...');
            setTimeout(iniciarBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message) return;

        const jid = m.key.remoteJid;
        const texto = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim().toLowerCase();

        // 1. MENU
        if (texto === '#menu') {
            const menuText = `✨ *BOT MULTIVERSAL MULTIMEDIA V15.0* ✨\n\n*Comandos:*\n• #play [canción] - Descarga MP3 🎵\n• #images [personaje] - Ilustraciones Variadas 🦸‍♂️🔄\n• #memes [tema] - Memes MP4 🎭⚡\n• #packstickers [nombre] - Pack Stickers 📦🔥\n• #ia [pregunta] - Habla con Gemini 🤖\n• #s - Convertir a Sticker 🎨🎬\n• #sky - Sticker a Imagen/Video 🔄\n• #ping - Verificar bot`;
            await sock.sendMessage(jid, { text: menuText });
        }

       // 2. COMANDO: #PLAY (VERSIÓN ESTABLE)
        else if (texto.startsWith('#play ')) {
            const busqueda = texto.replace('#play ', '').trim();
            if (!busqueda) return await sock.sendMessage(jid, { text: '⚠️ Escribe el nombre de la canción.' });

            await sock.sendMessage(jid, { text: `🔍 Buscando y preparando: ${busqueda}...` });

            try {
                const yts = (await import('yt-search')).default;
                const resultado = await yts(busqueda);
                const video = resultado.videos[0];
                if (!video) return await sock.sendMessage(jid, { text: '❌ No encontrado.' });

                // Usamos una API externa para descargar el MP3, así no dependemos de ffmpeg en la nube
                const audioUrl = `https://api.vreden.my.id/api/ytmp3?url=${video.url}`;
                
                await sock.sendMessage(jid, { 
                    audio: { url: audioUrl }, 
                    mimetype: 'audio/mpeg',
                    caption: `🎵 *${video.title}*`
                });

            } catch (error) {
                console.error(error);
                await sock.sendMessage(jid, { text: '⚠️ Error al procesar el audio. Intenta otro tema.' });
            }
        }

        // 3. COMANDO: #IMAGES
        else if (texto.startsWith('#images ')) {
            let busquedaUser = texto.replace('#images ', '').trim().toLowerCase();
            if (!busquedaUser) return await sock.sendMessage(jid, { text: '⚠️ Escribe el personaje.' });

            if (busquedaUser.includes('jane doe')) busquedaUser = 'jane';
            if (busquedaUser.includes('zhu yuan')) busquedaUser = 'zhu_yuan';
            if (busquedaUser.includes('burnice')) busquedaUser = 'burnice';
            if (busquedaUser.includes('caesar')) busquedaUser = 'caesar';

            let urlWikiApi = 'https://umamusume.fandom.com/api.php'; 
            let origenUniverso = 'Umamusume';

            const pjsZZZ = ['ellen', 'joe', 'billy', 'kid', 'nicole', 'demara', 'anby', 'miyabi', 'zhu', 'qingyi', 'seth', 'jane', 'grace', 'anton', 'ben', 'koleda', 'lycaon', 'corin', 'rina', 'soukaku', 'lucy', 'piper', 'caesar', 'burnice', 'lighter', 'zzz', 'zenless'];
            const pjsInvincible = ['invincible', 'mark grayson', 'omni man', 'omniman', 'noland', 'atom eve', 'thragg', 'battle beast', 'allen', 'angstrom', 'robot', 'rex splode', 'monster girl', 'dupli kate', 'comic', 'invencible', 'mohawk', 'movincihawk'];

            if (pjsZZZ.some(pj => busquedaUser.includes(pj))) {
                urlWikiApi = 'https://zenless-zone-zero.fandom.com/api.php';
                busquedaUser = busquedaUser.replace('zzz', '').replace('zenless', '').trim();
                origenUniverso = 'Zenless Zone Zero';
            } else if (pjsInvincible.some(pj => busquedaUser.includes(pj))) {
                urlWikiApi = 'https://invincible.fandom.com/api.php';
                origenUniverso = 'Invincible';
            }

            await sock.sendMessage(jid, { text: `🔍 Extrayendo imagen de la galería de *${origenUniverso}*...` });

            try {
                const urlBusqueda = `${urlWikiApi}?action=query&list=search&srsearch=${encodeURIComponent(busquedaUser)}&format=json&origin=*`;
                const resBusqueda = await axios.get(urlBusqueda);
                const item = resBusqueda.data?.query?.search?.[0];

                if (!item) return await sock.sendMessage(jid, { text: `❌ No encontré registros para *${busquedaUser}*.` });

                const pageTitle = item.title;
                const urlImagenesPagina = `${urlWikiApi}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=images&imlimit=120&format=json&origin=*`;
                const resImgList = await axios.get(urlImagenesPagina);
                const pagesImg = resImgList.data?.query?.pages;
                const idPageImg = Object.keys(pagesImg)[0];
                const listaArchivos = pagesImg[idPageImg]?.images || [];

                let archivosValidos = listaArchivos.filter(img => {
                    const n = img.title.toLowerCase();
                    return (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg')) && !n.includes('icon');
                });

                let imagenEncontrada = null;

                if (archivosValidos.length > 0) {
                    const archivoAleatorio = archivosValidos[Math.floor(Math.random() * archivosValidos.length)];
                    const urlConvertir = `${urlWikiApi}?action=query&titles=${encodeURIComponent(archivoAleatorio.title)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
                    const resConvertir = await axios.get(urlConvertir);
                    const pagesConv = resConvertir.data?.query?.pages;
                    const idConv = Object.keys(pagesConv)[0];
                    imagenEncontrada = pagesConv[idConv]?.imageinfo?.[0]?.url;
                }

                if (!imagenEncontrada) {
                    const urlImagenBase = `${urlWikiApi}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=1200&format=json&origin=*`;
                    const resImgBase = await axios.get(urlImagenBase);
                    const pages = resImgBase.data?.query?.pages;
                    const pageId = Object.keys(pages)[0];
                    imagenEncontrada = pages[pageId]?.thumbnail?.source;
                }

                if (imagenEncontrada) {
                    await sock.sendMessage(jid, { image: { url: imagenEncontrada }, caption: `🎲 *${pageTitle}* - Universo de ${origenUniverso}.` });
                } else {
                    await sock.sendMessage(jid, { text: `❌ No se encontraron recursos visuales disponibles.` });
                }
            } catch (e) {
                await sock.sendMessage(jid, { text: '⚠️ Error al conectar con los servidores de metadatos.' });
            }
        }

        // 4. COMANDO: #MEMES
        else if (texto.startsWith('#memes ')) {
            const temaMeme = texto.replace('#memes ', '').trim();
            if (!temaMeme) return await sock.sendMessage(jid, { text: '⚠️ Especifica el tema del meme.' });

            await sock.sendMessage(jid, { text: `🎭 Capturando meme de *${temaMeme}*...` });
            let urlsEncontradas = [];

            try {
                const offset = Math.floor(Math.random() * 20);
                const resGiphy = await axios.get(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(temaMeme + ' meme')}&limit=15&offset=${offset}&rating=g`);
                if (resGiphy.data?.data) {
                    resGiphy.data.data.forEach(item => {
                        const urlLink = item.images.looping?.mp4 || item.images.downsized_small?.mp4;
                        if (urlLink) urlsEncontradas.push(urlLink);
                    });
                }
            } catch (e) {}

            if (urlsEncontradas.length === 0) {
                return await sock.sendMessage(jid, { text: `❌ No encontré memes para *${temaMeme}*.` });
            }

            urlsEncontradas.sort(() => Math.random() - 0.5);

            let enviado = false;
            for (const urlIntentar of urlsEncontradas) {
                try {
                    const respuestaMeme = await axios.get(urlIntentar, { responseType: 'arraybuffer', timeout: 5000 });
                    const bufferMeme = Buffer.from(respuestaMeme.data, 'binary');

                    if (bufferMeme.length < 5000) continue; 

                    await sock.sendMessage(jid, { video: bufferMeme, gifPlayback: true, caption: `😂 Meme: *${temaMeme}*` });
                    enviado = true;
                    break;
                } catch (err) {
                    continue;
                }
            }

            if (!enviado) {
                await sock.sendMessage(jid, { text: '❌ No se pudo descargar el meme. Intenta de nuevo.' });
            }
        }

        // 5. COMANDO: #PACKSTICKERS
        else if (texto.startsWith('#packstickers ')) {
            const personaje = texto.replace('#packstickers ', '').trim();
            if (!personaje) return await sock.sendMessage(jid, { text: '⚠️ ¿De qué personaje quieres el pack?' });

            await sock.sendMessage(jid, { text: `🎬 Buscando en la súper galería global para: *${personaje}*...` });
            let listaUrls = [];

            let terminoLimpio = personaje.toLowerCase().trim();
            let busquedaGiphy = terminoLimpio;
            let tagsSecundarios = []; 

            if (terminoLimpio.includes('burnice')) {
                tagsSecundarios = ['burnice_white_(zenless_zone_zero)', 'burnice_white'];
                busquedaGiphy = 'burnice white zenless zone zero';
            } else if (terminoLimpio.includes('caesar')) {
                tagsSecundarios = ['caesar_king_(zenless_zone_zero)', 'caesar_king'];
                busquedaGiphy = 'caesar king zenless zone zero';
            } else if (terminoLimpio.includes('jane doe') || terminoLimpio === 'jane') {
                tagsSecundarios = ['jane_doe_(zenless_zone_zero)', 'jane_doe'];
                busquedaGiphy = 'jane doe zenless zone zero';
            } else if (terminoLimpio.includes('zhu yuan')) {
                tagsSecundarios = ['zhu_yuan_(zenless_zone_zero)', 'zhu_yuan'];
                busquedaGiphy = 'zhu yuan zenless zone zero';
            } else if (terminoLimpio.includes('ellen joe') || terminoLimpio === 'ellen') {
                tagsSecundarios = ['ellen_joe', 'ellen_joe_(zenless_zone_zero)'];
                busquedaGiphy = 'ellen joe zenless zone zero';
            } else if (terminoLimpio.includes('lighter')) {
                tagsSecundarios = ['lighter_(zenless_zone_zero)', 'lighter'];
                busquedaGiphy = 'lighter zenless zone zero';
            } else if (terminoLimpio.includes('miyabi')) {
                tagsSecundarios = ['hoshimi_miyabi', 'hoshimi_miyabi_(zenless_zone_zero)'];
                busquedaGiphy = 'miyabi zenless zone zero';
            } else if (terminoLimpio.includes('seth')) {
                tagsSecundarios = ['seth_lowell_(zenless_zone_zero)', 'seth_lowell'];
                busquedaGiphy = 'seth lowell zenless zone zero';
            } else {
                let formatoGuion = terminoLimpio.replace(/ /g, '_');
                tagsSecundarios = [formatoGuion + '_(umamusume)', formatoGuion + '_(comic)', formatoGuion];
            }

            // --- FUENTES DE DATOS ---
            for (const tag of tagsSecundarios) {
                try {
                    const res = await axios.get(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}+rating:general&limit=15`, { timeout: 4000 });
                    if (Array.isArray(res.data) && res.data.length > 0) {
                        res.data.forEach(post => {
                            if (post.file_url && !post.file_url.endsWith('.mp4') && !post.file_url.endsWith('.zip')) {
                                listaUrls.push({ url: post.file_url, animado: false });
                            }
                        });
                        break; 
                    }
                } catch (e) {}
            }

            try {
                let tagSafe = tagsSecundarios[0];
                const resSafe = await axios.get(`https://safebooru.org/index.php?page=dapi&s=post&q=index&tags=${encodeURIComponent(tagSafe)}&json=1&limit=15`, { timeout: 4000 });
                if (Array.isArray(resSafe.data)) {
                    resSafe.data.forEach(post => {
                        if (post.image) {
                            let urlCompleta = `https://safebooru.org//images/${post.directory}/${post.image}`;
                            listaUrls.push({ url: urlCompleta, animado: false });
                        }
                    });
                }
            } catch (e) {}

            try {
                let tagGel = tagsSecundarios[0];
                const resGel = await axios.get(`https://gelbooru.com/index.php?page=dapi&s=post&q=index&tags=${encodeURIComponent(tagGel)}+rating:general&json=1&limit=15`, { timeout: 4000 });
                if (resGel.data && Array.isArray(resGel.data.post)) {
                    resGel.data.post.forEach(post => {
                        if (post.file_url) listaUrls.push({ url: post.file_url, animado: false });
                    });
                }
            } catch (e) {}

            try {
                const offsetGiphy = Math.floor(Math.random() * 3);
                const resGiphy = await axios.get(`https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(busquedaGiphy)}&limit=12&offset=${offsetGiphy}&rating=g`, { timeout: 4000 });
                if (resGiphy.data?.data) {
                    resGiphy.data.data.forEach(item => {
                        const urlSticker = item.images.fixed_height?.url || item.images.original?.url;
                        if (urlSticker) listaUrls.push({ url: urlSticker, animado: true });
                    });
                }
            } catch (e) {}

            if (listaUrls.length === 0) {
                return await sock.sendMessage(jid, { text: `❌ Súper galería vacía para *${personaje}*. Revisa la ortografía.` });
            }

            listaUrls.sort(() => Math.random() - 0.5);
            let seleccionados = listaUrls.slice(0, 3);
            let totalEnviados = 0;

            for (const item of seleccionados) {
                const outputPath = path.join(process.cwd(), `temp_pack_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.webp`);
                try {
                    const resImage = await axios.get(item.url, { responseType: 'arraybuffer', timeout: 8000 });
                    const buffer = Buffer.from(resImage.data, 'binary');

                    if (buffer.length < 3000) continue;

                    if (item.animado) {
                        await sharp(buffer, { animated: true, failOnError: false })
                            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                            .webp({ quality: 40, delay: 85, effort: 4 }) 
                            .toFile(outputPath);
                    } else {
                        await sharp(buffer, { failOnError: false })
                            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                            .webp({ quality: 75 }) 
                            .toFile(outputPath);
                    }

                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0 && fs.statSync(outputPath).size < 1048576) { 
                        await sock.sendMessage(jid, { sticker: fs.readFileSync(outputPath) });
                        totalEnviados++;
                    }
                } catch (err) {}
                
                try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch(e){}
                await new Promise(resolve => setTimeout(resolve, 2000)); 
            }

            if (totalEnviados === 0) {
                await sock.sendMessage(jid, { text: '⚠️ No se pudieron procesar los stickers de esta tanda.' });
            }
        }

        // 6. COMANDO: #IA (CORREGIDO LA SINTAXIS DE GOOGLE GEMINI)
        else if (texto.startsWith('#ia ')) {
            const pregunta = texto.replace('#ia ', '').trim();
            if (!pregunta) return await sock.sendMessage(jid, { text: '⚠️ ¿Qué deseas preguntar?' });

            try {
                const model = ai.getGenerativeModel({ 
                    model: 'gemini-1.5-flash',
                    systemInstruction: "Eres un bot de WhatsApp experto en anime, cómics de Invincible y videojuegos. Usa emojis."
                });
                
                const result = await model.generateContent(pregunta);
                const response = await result.response;
                const textoRespuesta = response.text();
                
                if (textoRespuesta) {
                    await sock.sendMessage(jid, { text: textoRespuesta });
                }
            } catch (error) {
                console.error(error);
                await sock.sendMessage(jid, { text: '❌ Error de conexión con la IA.' });
            }
        }

        // 7. COMANDO: #S
        else if (texto === '#s') {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const msgImagen = m.message.imageMessage || quoted?.imageMessage;
            const msgVideo = m.message.videoMessage || quoted?.videoMessage;

            if (!msgImagen && !msgVideo) {
                return await sock.sendMessage(jid, { text: '⚠️ Responde con *#s* a una Imagen o Video.' });
            }

            await sock.sendMessage(jid, { text: '🎬 Convirtiendo multimedia...' });

            try {
                if (msgImagen) {
                    const stream = await baileys.downloadContentFromMessage(msgImagen, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    
                    const processedBuffer = await sharp(buffer)
                        .resize(512, 512, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
                        .webp()
                        .toBuffer();

                    await sock.sendMessage(jid, { sticker: processedBuffer });

                } else if (msgVideo) {
                    const stream = await baileys.downloadContentFromMessage(msgVideo, 'video');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    
                    const inputVideoTemp = path.join(process.cwd(), `v_in_${Date.now()}.mp4`);
                    const outputWebpTemp = path.join(process.cwd(), `v_out_${Date.now()}.webp`);
                    fs.writeFileSync(inputVideoTemp, buffer);

                    ffmpeg(inputVideoTemp)
                        .duration(4)
                        .noAudio()
                        .outputOptions([
                            '-vcodec', 'libwebp',
                            '-vf', 'fps=12,scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:color=black@0',
                            '-q:v', '45',
                            '-loop', '0'
                        ])
                        .toFormat('webp')
                        .on('end', async () => {
                            if (fs.existsSync(outputWebpTemp)) {
                                await sock.sendMessage(jid, { sticker: fs.readFileSync(outputWebpTemp) });
                            }
                            try { fs.unlinkSync(inputVideoTemp); } catch(e){}
                            try { fs.unlinkSync(outputWebpTemp); } catch(e){}
                        })
                        .on('error', async () => {
                            try {
                                const staticBuffer = await sharp(buffer, { failOnError: false }).resize(512, 512).webp().toBuffer();
                                await sock.sendMessage(jid, { sticker: staticBuffer });
                            } catch(e) {
                                await sock.sendMessage(jid, { text: '❌ Formato incompatible.' });
                            }
                            try { if(fs.existsSync(inputVideoTemp)) fs.unlinkSync(inputVideoTemp); } catch(e){}
                            try { if(fs.existsSync(outputWebpTemp)) fs.unlinkSync(outputWebpTemp); } catch(e){}
                        })
                        .save(outputWebpTemp);
                }
            } catch (error) {
                await sock.sendMessage(jid, { text: '⚠️ No se pudo procesar este elemento.' });
            }
        }

        // 8. COMANDO: #SKY
        else if (texto === '#sky') {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const stickerMessage = m.message.stickerMessage || quoted?.stickerMessage;
            if (!stickerMessage) return await sock.sendMessage(jid, { text: '⚠️ Responde directamente a un sticker.' });

            await sock.sendMessage(jid, { text: `🔄 Leyendo cifrado del sticker...` });

            let bufferSticker = null;
            for (let i = 0; i < 4; i++) {
                try {
                    const stream = await baileys.downloadContentFromMessage(stickerMessage, 'sticker');
                    let chunks = Buffer.from([]);
                    for await (const chunk of stream) chunks = Buffer.concat([chunks, chunk]);
                    if (chunks && chunks.length > 200) {
                        bufferSticker = chunks;
                        break;
                    }
                } catch (e) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (!bufferSticker) {
                return await sock.sendMessage(jid, { text: '❌ WhatsApp no ha procesado el sticker. Intenta de nuevo.' });
            }

            const pathWebpInput = path.join(process.cwd(), `sky_in_${Date.now()}.webp`);
            const pathMp4Output = path.join(process.cwd(), `sky_out_${Date.now()}.mp4`);

            try {
                fs.writeFileSync(pathWebpInput, bufferSticker);

                let metadata = { pages: 0 };
                try { metadata = await sharp(pathWebpInput).metadata(); } catch (e) {}

                if (metadata.pages && metadata.pages > 1) {
                    ffmpeg(pathWebpInput)
                        .inputOptions(['-vcodec', 'webp'])
                        .outputOptions(['-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'])
                        .toFormat('mp4')
                        .on('end', async () => {
                            if (fs.existsSync(pathMp4Output)) {
                                await sock.sendMessage(jid, { video: fs.readFileSync(pathMp4Output), gifPlayback: true, caption: '✅ Extraído con éxito.' });
                            }
                            try { fs.unlinkSync(pathWebpInput); } catch(e){}
                            try { fs.unlinkSync(pathMp4Output); } catch(e){}
                        })
                        .on('error', async () => {
                            try {
                                const fallbackImg = await sharp(pathWebpInput, { failOnError: false }).png().toBuffer();
                                await sock.sendMessage(jid, { image: fallbackImg, caption: '✅ Renderizado como Imagen Fija.' });
                            } catch(err){}
                            try { fs.unlinkSync(pathWebpInput); } catch(e){}
                            try { if(fs.existsSync(pathMp4Output)) fs.unlinkSync(pathMp4Output); } catch(e){}
                        })
                        .save(pathMp4Output);
                } else {
                    const pngBuffer = await sharp(pathWebpInput).png().toBuffer();
                    await sock.sendMessage(jid, { image: pngBuffer, caption: '✅ Sticker convertido a imagen.' });
                    try { fs.unlinkSync(pathWebpInput); } catch(e){}
                }
            } catch (error) {
                try { if(fs.existsSync(pathWebpInput)) fs.unlinkSync(pathWebpInput); } catch(e){}
                await sock.sendMessage(jid, { text: '❌ Error de renderizado estructural.' });
            }
        }

        // 9. PING
        else if (texto === '#ping') {
            await sock.sendMessage(jid, { text: '¡El bot está vivo y funcionando! 🤖' });
        }
    });
}

iniciarBot();
// Transports locaux de recette : aucune modification du site SPIP et aucun DNS externe.
import http from 'node:http';
import https from 'node:https';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const ecouter = (serveur) => new Promise((resolve, reject) => {
	serveur.once('error', reject); serveur.listen(0, '127.0.0.1', () => resolve(serveur.address().port));
});
const fermer = async (serveur) => {
	if (!serveur?.listening) return;
	serveur.closeAllConnections(); await new Promise((r) => serveur.close(r));
};
const relayer = (req, res, destination, ssl = false) => {
	const path = new URL(req.url, destination);
	const headers = { ...req.headers, ...(ssl ? { 'x-forwarded-proto': 'https' } : {}) };
	const suite = http.request(new URL(path.pathname + path.search, destination), { method: req.method, headers }, (r) => {
		res.writeHead(r.statusCode, r.headers); r.pipe(res);
	});
	suite.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
	res.on('close', () => { if (!res.writableEnded) suite.destroy(); }); req.pipe(suite);
};

export async function demarrerTransportsEmoji({ site, base, php = 'php' }) {
	const dossier = mkdtempSync(join(tmpdir(), 'tts-emoji-transports-'));
	let enfant, proxy, tls;
	const close = async () => {
		await Promise.all([fermer(proxy), fermer(tls)]);
		if (enfant?.pid) { try { process.kill(-enfant.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; } }
		rmSync(dossier, { recursive: true, force: true });
	};
	try {
		proxy = http.createServer((req, res) => {
			const adresse = new URL(req.url);
			if (adresse.hostname !== 'tts-emojis.test') { res.writeHead(403); res.end(); return; }
			relayer(req, res, base);
		});
		const proxyPort = await ecouter(proxy);
		const reservation = http.createServer(); const port = await ecouter(reservation); await fermer(reservation);
		const routeur = join(dossier, 'routeur.php');
		writeFileSync(routeur, `<?php
if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
 $_SERVER['HTTPS'] = 'on'; $_SERVER['REQUEST_SCHEME'] = 'https';
}
return false;
`);
		enfant = spawn(php, ['-d', 'opcache.revalidate_freq=0', '-S', `127.0.0.1:${port}`, '-t', site, routeur], {
			detached: true, env: { ...process.env, PHP_CLI_SERVER_WORKERS: '4' }, stdio: ['ignore', 'pipe', 'pipe'],
		});
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('Serveur PHP TLS non démarré')), 5000);
			enfant.once('error', (e) => { clearTimeout(timer); reject(e); });
			enfant.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Serveur PHP arrêté (${code})`)); });
			enfant.stdout.on('data', () => {});
			enfant.stderr.on('data', (data) => { if (data.toString().includes('Development Server')) { clearTimeout(timer); resolve(); } });
		});
		const cle = join(dossier, 'cle.pem'), cert = join(dossier, 'cert.pem');
		execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
			'-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost', '-keyout', cle, '-out', cert], { stdio: 'ignore' });
		chmodSync(cle, 0o600);
		tls = https.createServer({ key: readFileSync(cle), cert: readFileSync(cert) }, (req, res) => relayer(req, res, `http://127.0.0.1:${port}`, true));
		const tlsPort = await ecouter(tls);
		return { proxy: `http://127.0.0.1:${proxyPort}`, https: `https://127.0.0.1:${tlsPort}`, close };
	} catch (e) { await close(); throw e; }
}

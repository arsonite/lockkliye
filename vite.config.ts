/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 */

import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import { resolve } from 'path';

// Ports come from .env (see .env.template), the defaults match the app registry of homepie
// (homepie/src/nginx/conf.d/00-homepie-apps.conf)
export const getBaseViteConfig = (): UserConfig => {
    const env = loadEnv(process.env.NODE_ENV ?? 'development', __dirname, '');
    const clientPort = Number(env.LOCKKLIYE_CLIENT_PORT ?? 8101);
    const serverPort = Number(env.LOCKKLIYE_PORT ?? 8765);

    return {
        // homepie publishes the app under https://homepie.net/lockkliye/, so that it stays inside the fullscreen
        // home screen app of homepie (iOS leaves it when navigating to another origin)
        base: '/lockkliye/',
        plugins: [react(), eslint()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'client'),
                '@teatype': resolve(__dirname, '../teatype/ts'),
            },
        },
        css: {
            preprocessorOptions: {
                scss: {
                    // Shared components' SCSS relies on globvars being available everywhere
                    additionalData: (source: string, filename: string) =>
                        filename.includes('globvars')
                            ? source
                            : `@use "${resolve(__dirname, '../teatype/ts/style/globvars').replace(/\\/g, '/')}" as *;\n${source}`,
                },
            },
        },
        server: {
            // Only reachable through the homepie nginx (https://homepie.net/lockkliye/), which handles the login
            host: '127.0.0.1',
            port: clientPort,
            strictPort: true,
            open: false,
            allowedHosts: ['localhost', '.homepie.net'],
            // The browser talks to this origin only, the HSDB server (127.0.0.1:<LOCKKLIYE_PORT>) is not exposed
            proxy: {
                '/lockkliye/hsdb': {
                    target: `http://127.0.0.1:${serverPort}`,
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/lockkliye/, ''),
                },
            },
        },
    };
};

export default defineConfig(getBaseViteConfig());

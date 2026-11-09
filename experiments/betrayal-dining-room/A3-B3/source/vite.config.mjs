import { defineConfig } from 'vite';
export default defineConfig({base:'./',server:{host:'127.0.0.1',port:5195,strictPort:true},build:{target:'es2022',outDir:'dist',emptyOutDir:true}});

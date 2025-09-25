import * as esbuild from 'esbuild'

const ctx = await esbuild.context({
entryPoints: ['src/app.mjs'],
bundle: true,
minify: false,
sourcemap: false,
target: ['es2020'],
format: 'iife',
  banner: {
    js: `
     
       function require(m) {
         const MODS = {
          "@microsoft/msfs-sdk": window.msfssdk,
          "@microsoft/msfs-wt21-fmc": window.vtx21PluginImports,
          "@microsoft/msfs-wt21-shared": window.vtx21PluginImports
         }
        if(MODS[m])
          return MODS[m];
         throw new Error(\`Unknown module \${m}\`);
       }
    `,
  },

jsx: 'transform',
jsxFactory: 'FSComponent.buildComponent', // MSFS SDK JSX factory
jsxFragment: 'FSComponent.Fragment',
  outfile: './package/PackageSources/Copys/flightfx-cx-plugin/web-ui/Pages/Vcockpit/instruments/vtx21/fmc/plugins/flightfx-cx-plus.js',
  external: ["@microsoft/msfs-sdk", "@microsoft/msfs-wt21-fmc", "@microsoft/msfs-wt21-shared"]
})
await ctx.watch();
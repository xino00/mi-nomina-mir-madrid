import type {CapacitorConfig} from '@capacitor/cli';
const config:CapacitorConfig={
  appId:'es.juanarenas.minomina',appName:'Mi nómina',webDir:'dist',loggingBehavior:'none',
  server:{androidScheme:'https',cleartext:false,errorPath:'webview-error.html'},
  android:{backgroundColor:'#0B0C0A',allowMixedContent:false,minWebViewVersion:119},
  plugins:{CapacitorSQLite:{androidIsEncryption:false},SystemBars:{style:'DARK'}}
};
export default config;

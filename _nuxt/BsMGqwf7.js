import{n as h,Y as c,t as o,p as g,O as n,s as u}from"./BhbIh-14.js";(function(){try{var t=typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{},r=new t.Error().stack;r&&(t._sentryDebugIds=t._sentryDebugIds||{},t._sentryDebugIds[r]="0e453897-4bd5-4a2e-9c32-f850615c995c",t._sentryDebugIdIdentifier="sentry-dbid-0e453897-4bd5-4a2e-9c32-f850615c995c")}catch{}})();var f=Object.defineProperty,w=Object.getOwnPropertyDescriptor,l=(t,r,i,s)=>{for(var a=s>1?void 0:s?w(r,i):r,d=t.length-1,p;d>=0;d--)(p=t[d])&&(a=(s?p(r,i,a):p(a))||a);return s&&a&&f(r,i,a),a};let e=class extends h{constructor(){super(...arguments),this.size="1em",this.weight="regular",this.color="currentColor",this.mirrored=!1}render(){var t;return c`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="${this.size}"
      height="${this.size}"
      fill="${this.color}"
      viewBox="0 0 256 256"
      transform=${this.mirrored?"scale(-1, 1)":null}
    >
      ${e.weightsMap.get((t=this.weight)!=null?t:"regular")}
    </svg>`}};e.weightsMap=new Map([["thin",o`<path d="M202.83,146.83l-72,72a4,4,0,0,1-5.66,0l-72-72a4,4,0,0,1,5.66-5.66L124,206.34V40a4,4,0,0,1,8,0V206.34l65.17-65.17a4,4,0,0,1,5.66,5.66Z"/>`],["light",o`<path d="M204.24,148.24l-72,72a6,6,0,0,1-8.48,0l-72-72a6,6,0,0,1,8.48-8.48L122,201.51V40a6,6,0,0,1,12,0V201.51l61.76-61.75a6,6,0,0,1,8.48,8.48Z"/>`],["regular",o`<path d="M205.66,149.66l-72,72a8,8,0,0,1-11.32,0l-72-72a8,8,0,0,1,11.32-11.32L120,196.69V40a8,8,0,0,1,16,0V196.69l58.34-58.35a8,8,0,0,1,11.32,11.32Z"/>`],["bold",o`<path d="M208.49,152.49l-72,72a12,12,0,0,1-17,0l-72-72a12,12,0,0,1,17-17L116,187V40a12,12,0,0,1,24,0V187l51.51-51.52a12,12,0,0,1,17,17Z"/>`],["fill",o`<path d="M205.66,149.66l-72,72a8,8,0,0,1-11.32,0l-72-72A8,8,0,0,1,56,136h64V40a8,8,0,0,1,16,0v96h64a8,8,0,0,1,5.66,13.66Z"/>`],["duotone",o`<path d="M200,144l-72,72L56,144Z" opacity="0.2"/><path d="M207.39,140.94A8,8,0,0,0,200,136H136V40a8,8,0,0,0-16,0v96H56a8,8,0,0,0-5.66,13.66l72,72a8,8,0,0,0,11.32,0l72-72A8,8,0,0,0,207.39,140.94ZM128,204.69,75.31,152H180.69Z"/>`]]);e.styles=g`
    :host {
      display: contents;
    }
  `;l([n({type:String,reflect:!0})],e.prototype,"size",2);l([n({type:String,reflect:!0})],e.prototype,"weight",2);l([n({type:String,reflect:!0})],e.prototype,"color",2);l([n({type:Boolean,reflect:!0})],e.prototype,"mirrored",2);e=l([u("ph-arrow-down")],e);export{e as PhArrowDown};

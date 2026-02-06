import{n as p,Y as h,t as a,p as g,O as s,s as c}from"./CQOms9A4.js";(function(){try{var e=typeof window<"u"?window:typeof global<"u"?global:typeof globalThis<"u"?globalThis:typeof self<"u"?self:{};e.SENTRY_RELEASE={id:"cd189bad150b481aa5ecb2e95de26ec677010e55"}}catch{}})();try{(function(){var e=typeof window<"u"?window:typeof global<"u"?global:typeof globalThis<"u"?globalThis:typeof self<"u"?self:{},r=new e.Error().stack;r&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[r]="b94bfd14-e87e-4c1f-8e84-4b278a5bd3ac",e._sentryDebugIdIdentifier="sentry-dbid-b94bfd14-e87e-4c1f-8e84-4b278a5bd3ac")})()}catch{}var u=Object.defineProperty,y=Object.getOwnPropertyDescriptor,l=(e,r,d,i)=>{for(var o=i>1?void 0:i?y(r,d):r,n=e.length-1,f;n>=0;n--)(f=e[n])&&(o=(i?f(r,d,o):f(o))||o);return i&&o&&u(r,d,o),o};let t=class extends p{constructor(){super(...arguments),this.size="1em",this.weight="regular",this.color="currentColor",this.mirrored=!1}render(){var e;return h`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="${this.size}"
      height="${this.size}"
      fill="${this.color}"
      viewBox="0 0 256 256"
      transform=${this.mirrored?"scale(-1, 1)":null}
    >
      ${t.weightsMap.get((e=this.weight)!=null?e:"regular")}
    </svg>`}};t.weightsMap=new Map([["thin",a`<path d="M162.83,205.17a4,4,0,0,1-5.66,5.66l-80-80a4,4,0,0,1,0-5.66l80-80a4,4,0,1,1,5.66,5.66L85.66,128Z"/>`],["light",a`<path d="M164.24,203.76a6,6,0,1,1-8.48,8.48l-80-80a6,6,0,0,1,0-8.48l80-80a6,6,0,0,1,8.48,8.48L88.49,128Z"/>`],["regular",a`<path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/>`],["bold",a`<path d="M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z"/>`],["fill",a`<path d="M168,48V208a8,8,0,0,1-13.66,5.66l-80-80a8,8,0,0,1,0-11.32l80-80A8,8,0,0,1,168,48Z"/>`],["duotone",a`<path d="M160,48V208L80,128Z" opacity="0.2"/><path d="M163.06,40.61a8,8,0,0,0-8.72,1.73l-80,80a8,8,0,0,0,0,11.32l80,80A8,8,0,0,0,168,208V48A8,8,0,0,0,163.06,40.61ZM152,188.69,91.31,128,152,67.31Z"/>`]]);t.styles=g`
    :host {
      display: contents;
    }
  `;l([s({type:String,reflect:!0})],t.prototype,"size",2);l([s({type:String,reflect:!0})],t.prototype,"weight",2);l([s({type:String,reflect:!0})],t.prototype,"color",2);l([s({type:Boolean,reflect:!0})],t.prototype,"mirrored",2);t=l([c("ph-caret-left")],t);export{t as PhCaretLeft};

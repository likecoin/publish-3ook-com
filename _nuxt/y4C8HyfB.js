import{n as c,Y as h,t as o,p as g,O as n,s as f}from"./BhbIh-14.js";(function(){try{var t=typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{},r=new t.Error().stack;r&&(t._sentryDebugIds=t._sentryDebugIds||{},t._sentryDebugIds[r]="c4d0ae9f-3c5c-4294-932d-0e59c93bbbbf",t._sentryDebugIdIdentifier="sentry-dbid-c4d0ae9f-3c5c-4294-932d-0e59c93bbbbf")}catch{}})();var u=Object.defineProperty,y=Object.getOwnPropertyDescriptor,a=(t,r,i,s)=>{for(var l=s>1?void 0:s?y(r,i):r,d=t.length-1,p;d>=0;d--)(p=t[d])&&(l=(s?p(r,i,l):p(l))||l);return s&&l&&u(r,i,l),l};let e=class extends c{constructor(){super(...arguments),this.size="1em",this.weight="regular",this.color="currentColor",this.mirrored=!1}render(){var t;return h`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="${this.size}"
      height="${this.size}"
      fill="${this.color}"
      viewBox="0 0 256 256"
      transform=${this.mirrored?"scale(-1, 1)":null}
    >
      ${e.weightsMap.get((t=this.weight)!=null?t:"regular")}
    </svg>`}};e.weightsMap=new Map([["thin",o`<path d="M210.83,98.83l-80,80a4,4,0,0,1-5.66,0l-80-80a4,4,0,0,1,5.66-5.66L128,170.34l77.17-77.17a4,4,0,1,1,5.66,5.66Z"/>`],["light",o`<path d="M212.24,100.24l-80,80a6,6,0,0,1-8.48,0l-80-80a6,6,0,0,1,8.48-8.48L128,167.51l75.76-75.75a6,6,0,0,1,8.48,8.48Z"/>`],["regular",o`<path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/>`],["bold",o`<path d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z"/>`],["fill",o`<path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,48,88H208a8,8,0,0,1,5.66,13.66Z"/>`],["duotone",o`<path d="M208,96l-80,80L48,96Z" opacity="0.2"/><path d="M215.39,92.94A8,8,0,0,0,208,88H48a8,8,0,0,0-5.66,13.66l80,80a8,8,0,0,0,11.32,0l80-80A8,8,0,0,0,215.39,92.94ZM128,164.69,67.31,104H188.69Z"/>`]]);e.styles=g`
    :host {
      display: contents;
    }
  `;a([n({type:String,reflect:!0})],e.prototype,"size",2);a([n({type:String,reflect:!0})],e.prototype,"weight",2);a([n({type:String,reflect:!0})],e.prototype,"color",2);a([n({type:Boolean,reflect:!0})],e.prototype,"mirrored",2);e=a([f("ph-caret-down")],e);export{e as PhCaretDown};

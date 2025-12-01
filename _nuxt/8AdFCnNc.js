import{n as p,Y as g,t as s,p as c,O as n,s as f}from"./BhbIh-14.js";(function(){try{var t=typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{},r=new t.Error().stack;r&&(t._sentryDebugIds=t._sentryDebugIds||{},t._sentryDebugIds[r]="fe9b3126-6c15-46e2-8cd2-8390afdab555",t._sentryDebugIdIdentifier="sentry-dbid-fe9b3126-6c15-46e2-8cd2-8390afdab555")}catch{}})();var u=Object.defineProperty,y=Object.getOwnPropertyDescriptor,a=(t,r,i,l)=>{for(var o=l>1?void 0:l?y(r,i):r,d=t.length-1,h;d>=0;d--)(h=t[d])&&(o=(l?h(r,i,o):h(o))||o);return l&&o&&u(r,i,o),o};let e=class extends p{constructor(){super(...arguments),this.size="1em",this.weight="regular",this.color="currentColor",this.mirrored=!1}render(){var t;return g`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="${this.size}"
      height="${this.size}"
      fill="${this.color}"
      viewBox="0 0 256 256"
      transform=${this.mirrored?"scale(-1, 1)":null}
    >
      ${e.weightsMap.get((t=this.weight)!=null?t:"regular")}
    </svg>`}};e.weightsMap=new Map([["thin",s`<path d="M218.83,130.83l-72,72a4,4,0,0,1-5.66-5.66L206.34,132H40a4,4,0,0,1,0-8H206.34L141.17,58.83a4,4,0,0,1,5.66-5.66l72,72A4,4,0,0,1,218.83,130.83Z"/>`],["light",s`<path d="M220.24,132.24l-72,72a6,6,0,0,1-8.48-8.48L201.51,134H40a6,6,0,0,1,0-12H201.51L139.76,60.24a6,6,0,0,1,8.48-8.48l72,72A6,6,0,0,1,220.24,132.24Z"/>`],["regular",s`<path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/>`],["bold",s`<path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z"/>`],["fill",s`<path d="M221.66,133.66l-72,72A8,8,0,0,1,136,200V136H40a8,8,0,0,1,0-16h96V56a8,8,0,0,1,13.66-5.66l72,72A8,8,0,0,1,221.66,133.66Z"/>`],["duotone",s`<path d="M216,128l-72,72V56Z" opacity="0.2"/><path d="M221.66,122.34l-72-72A8,8,0,0,0,136,56v64H40a8,8,0,0,0,0,16h96v64a8,8,0,0,0,13.66,5.66l72-72A8,8,0,0,0,221.66,122.34ZM152,180.69V75.31L204.69,128Z"/>`]]);e.styles=c`
    :host {
      display: contents;
    }
  `;a([n({type:String,reflect:!0})],e.prototype,"size",2);a([n({type:String,reflect:!0})],e.prototype,"weight",2);a([n({type:String,reflect:!0})],e.prototype,"color",2);a([n({type:Boolean,reflect:!0})],e.prototype,"mirrored",2);e=a([f("ph-arrow-right")],e);export{e as PhArrowRight};

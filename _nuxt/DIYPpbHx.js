import{n as d,Y as g,t as s,p as c,O as n,s as u}from"./BhbIh-14.js";(function(){try{var t=typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{},a=new t.Error().stack;a&&(t._sentryDebugIds=t._sentryDebugIds||{},t._sentryDebugIds[a]="04d58c10-0a80-4f4b-a2a9-3be788c13a84",t._sentryDebugIdIdentifier="sentry-dbid-04d58c10-0a80-4f4b-a2a9-3be788c13a84")}catch{}})();var f=Object.defineProperty,y=Object.getOwnPropertyDescriptor,o=(t,a,i,h)=>{for(var r=h>1?void 0:h?y(a,i):a,p=t.length-1,l;p>=0;p--)(l=t[p])&&(r=(h?l(a,i,r):l(r))||r);return h&&r&&f(a,i,r),r};let e=class extends d{constructor(){super(...arguments),this.size="1em",this.weight="regular",this.color="currentColor",this.mirrored=!1}render(){var t;return g`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="${this.size}"
      height="${this.size}"
      fill="${this.color}"
      viewBox="0 0 256 256"
      transform=${this.mirrored?"scale(-1, 1)":null}
    >
      ${e.weightsMap.get((t=this.weight)!=null?t:"regular")}
    </svg>`}};e.weightsMap=new Map([["thin",s`<path d="M220,128a4,4,0,0,1-4,4H132v84a4,4,0,0,1-8,0V132H40a4,4,0,0,1,0-8h84V40a4,4,0,0,1,8,0v84h84A4,4,0,0,1,220,128Z"/>`],["light",s`<path d="M222,128a6,6,0,0,1-6,6H134v82a6,6,0,0,1-12,0V134H40a6,6,0,0,1,0-12h82V40a6,6,0,0,1,12,0v82h82A6,6,0,0,1,222,128Z"/>`],["regular",s`<path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/>`],["bold",s`<path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"/>`],["fill",s`<path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"/>`],["duotone",s`<path d="M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z" opacity="0.2"/><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/>`]]);e.styles=c`
    :host {
      display: contents;
    }
  `;o([n({type:String,reflect:!0})],e.prototype,"size",2);o([n({type:String,reflect:!0})],e.prototype,"weight",2);o([n({type:String,reflect:!0})],e.prototype,"color",2);o([n({type:Boolean,reflect:!0})],e.prototype,"mirrored",2);e=o([u("ph-plus")],e);export{e as PhPlus};

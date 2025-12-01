import{n as h,Y as g,t as o,p as c,O as d,s as f}from"./BhbIh-14.js";(function(){try{var t=typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{},r=new t.Error().stack;r&&(t._sentryDebugIds=t._sentryDebugIds||{},t._sentryDebugIds[r]="b2dac50e-8744-43fe-99b6-24688d7f9b08",t._sentryDebugIdIdentifier="sentry-dbid-b2dac50e-8744-43fe-99b6-24688d7f9b08")}catch{}})();var u=Object.defineProperty,y=Object.getOwnPropertyDescriptor,l=(t,r,i,s)=>{for(var a=s>1?void 0:s?y(r,i):r,n=t.length-1,p;n>=0;n--)(p=t[n])&&(a=(s?p(r,i,a):p(a))||a);return s&&a&&u(r,i,a),a};let e=class extends h{constructor(){super(...arguments),this.size="1em",this.weight="regular",this.color="currentColor",this.mirrored=!1}render(){var t;return g`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="${this.size}"
      height="${this.size}"
      fill="${this.color}"
      viewBox="0 0 256 256"
      transform=${this.mirrored?"scale(-1, 1)":null}
    >
      ${e.weightsMap.get((t=this.weight)!=null?t:"regular")}
    </svg>`}};e.weightsMap=new Map([["thin",o`<path d="M226.83,74.83l-128,128a4,4,0,0,1-5.66,0l-56-56a4,4,0,0,1,5.66-5.66L96,194.34,221.17,69.17a4,4,0,1,1,5.66,5.66Z"/>`],["light",o`<path d="M228.24,76.24l-128,128a6,6,0,0,1-8.48,0l-56-56a6,6,0,0,1,8.48-8.48L96,191.51,219.76,67.76a6,6,0,0,1,8.48,8.48Z"/>`],["regular",o`<path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/>`],["bold",o`<path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"/>`],["fill",o`<path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM205.66,85.66l-96,96a8,8,0,0,1-11.32,0l-40-40a8,8,0,0,1,11.32-11.32L104,164.69l90.34-90.35a8,8,0,0,1,11.32,11.32Z"/>`],["duotone",o`<path d="M232,56V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56Z" opacity="0.2"/><path d="M205.66,85.66l-96,96a8,8,0,0,1-11.32,0l-40-40a8,8,0,0,1,11.32-11.32L104,164.69l90.34-90.35a8,8,0,0,1,11.32,11.32Z"/>`]]);e.styles=c`
    :host {
      display: contents;
    }
  `;l([d({type:String,reflect:!0})],e.prototype,"size",2);l([d({type:String,reflect:!0})],e.prototype,"weight",2);l([d({type:String,reflect:!0})],e.prototype,"color",2);l([d({type:Boolean,reflect:!0})],e.prototype,"mirrored",2);e=l([f("ph-check")],e);export{e as PhCheck};

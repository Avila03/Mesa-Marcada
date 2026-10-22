declare function qrcode(typeNumber:number,errorCorrectionLevel:"L"|"M"|"Q"|"H"):{
 addData(data:string):void;
 make():void;
 createDataURL(cellSize?:number,margin?:number):string;
 getModuleCount():number;
 isDark(row:number,col:number):boolean;
};
export default qrcode;

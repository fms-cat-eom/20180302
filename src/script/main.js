import xorshift from "./libs/xorshift";
import Tweak from "./libs/tweak";
import GLCat from "./libs/glcat";
import GLCatPath from "./libs/glcat-path-gui";
import MathCat from "./libs/mathcat";

import cube from "./cube";

let glslify = require( "glslify" );

// ------

xorshift( 326789157890 );

// ------

let tweak = new Tweak( divTweak );

// ------

let mouseX = 0.0;
let mouseY = 0.0;

canvas.addEventListener( "mousemove", ( event ) => {
  mouseX = event.offsetX;
  mouseY = event.offsetY;
} );

// ------

let clamp = ( v, b, t ) => Math.min( Math.max( v, b ), t );
let lerp = ( a, b, x ) => a + ( b - a ) * x;
let saturate = ( v ) => clamp( v, 0.0, 1.0 );

// ------

let width = canvas.width = 360;
let height = canvas.height = 360;

let renderA = document.createElement( "a" );

let saveFrame = () => {
  renderA.href = canvas.toDataURL();
  renderA.download = ( "0000" + totalFrame ).slice( -5 ) + ".png";
  renderA.click();
};

// ------

let totalFrame = 0;
let init = false;
let frames = 200;

let automaton = new Automaton( {
  gui: divAutomaton,
  fps: frames,
  data: `
  {"v":"1.1.1","length":1,"resolution":1000,"params":{"cameraPosY":[{"time":0,"value":0.24637681159420288,"mode":1,"params":{},"mods":[false,false,false,false]},{"time":1,"value":0,"mode":0,"params":{},"mods":[false,false,false,false]}],"cameraRoll":[{"time":0,"value":0,"mode":1,"params":{},"mods":[false,false,false,false]},{"time":1,"value":0,"mode":0,"params":{},"mods":[false,false,false,false]}],"cameraTheta":[{"time":0,"value":0.05797101449275366,"mode":1,"params":{},"mods":[false,false,false,false]},{"time":1,"value":0.09661835748792269,"mode":0,"params":{},"mods":[false,false,false,false]}],"cameraRadius":[{"time":0,"value":5,"mode":1,"params":{},"mods":[false,false,false,false]},{"time":1,"value":1,"mode":0,"params":{},"mods":[false,false,false,false]}]},"gui":{"snap":{"enable":false,"bpm":120,"offset":0}}}
`
} );
let auto = automaton.auto;

// ------

let cameraPos = [ 0.0, 0.0, 8.0 ];
let cameraTar = [ 0.0, 0.0, 0.0 ];
let cameraRoll = 0.0;
let cameraFov = 90.0;

let cameraNear = 0.1;
let cameraFar = 100.0;

let lightPos = [ 0.0, -1.0, 10.0 ];

let matP;
let matV;
let matPL;
let matVL;

let updateMatrices = () => {
  let cameraTheta = auto( "cameraTheta" ) * Math.PI * 2.0;
  let cameraRadius = auto( "cameraRadius" );
  cameraPos[ 0 ] = cameraRadius * Math.sin( cameraTheta );
  cameraPos[ 1 ] = auto( "cameraPosY" );
  cameraPos[ 2 ] = cameraRadius * Math.cos( cameraTheta );
  cameraRoll = auto( "cameraRoll" );

  matP = MathCat.mat4Perspective( cameraFov, width / height, cameraNear, cameraFar );
  matV = MathCat.mat4LookAt( cameraPos, cameraTar, [ 0.0, 1.0, 0.0 ], cameraRoll );

  matPL = MathCat.mat4Perspective( cameraFov, 1.0, cameraNear, cameraFar );
  matVL = MathCat.mat4LookAt( lightPos, cameraTar, [ 0.0, 1.0, 0.0 ], 0.0 );
};
updateMatrices();

// ------

let gl = canvas.getContext( "webgl" );
gl.enable( gl.CULL_FACE );

let glCat = new GLCat( gl );

glCat.getExtension( "OES_texture_float", true );
glCat.getExtension( "OES_texture_float_linear", true );
glCat.getExtension( "EXT_frag_depth", true );
glCat.getExtension( "WEBGL_draw_buffers", true );
glCat.getExtension( "ANGLE_instanced_arrays", true );

let glCatPath = new GLCatPath( glCat, {
  drawbuffers: true,
  el: divPath,
  canvas: canvas,
  stretch: true
} );

// ------

let vboQuad = glCat.createVertexbuffer( [ -1, -1, 1, -1, -1, 1, 1, 1 ] );
let vboQuadUV = glCat.createVertexbuffer( [ 0, 1, 1, 1, 0, 0, 1, 0 ] );
let vboQuad3 = glCat.createVertexbuffer( [ -1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0 ] );
let vboQuad3Nor = glCat.createVertexbuffer( [ 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1 ] );

// ------

let vboCubePos = glCat.createVertexbuffer( cube.pos );
let vboCubeNor = glCat.createVertexbuffer( cube.nor );

// ------

let particlePixels = 2;
let particlesSqrt = 32;
let particles = particlesSqrt * particlesSqrt;
let vertsPerParticle = vboCubePos.length / 3;

let vboParticleUV = glCat.createVertexbuffer( ( () => {
  let ret = [];
  for ( let i = 0; i < particles; i ++ ) {
    let ix = i % particlesSqrt;
    let iy = Math.floor( i / particlesSqrt );
    
    ret.push( ix * particlePixels );
    ret.push( iy );
  }
  return ret;
} )() );

// ------

let terrainSize = 64;
let terrainVertices = terrainSize * terrainSize;

let terrainTriLength = ( terrainSize - 1 ) * ( terrainSize - 1 ) * 2;
let terrainUV = [];
let terrainTriIndex = [];

for ( let iy = 0; iy < terrainSize - 1; iy ++ ) {
  for ( let ix = 0; ix < terrainSize - 1; ix ++ ) {
    terrainUV.push(
      ( ix + 0.5 ) / terrainSize,
      ( iy + 0.5 ) / terrainSize,
      ( ix + 1.5 ) / terrainSize,
      ( iy + 0.5 ) / terrainSize,
      ( ix + 0.5 ) / terrainSize,
      ( iy + 1.5 ) / terrainSize,

      ( ix + 0.5 ) / terrainSize,
      ( iy + 1.5 ) / terrainSize,
      ( ix + 1.5 ) / terrainSize,
      ( iy + 0.5 ) / terrainSize,
      ( ix + 1.5 ) / terrainSize,
      ( iy + 1.5 ) / terrainSize
    );

    let i = ix + iy * ( terrainSize - 1 );
    terrainTriIndex.push(
      ( i * 2 + 0.5 ) / terrainTriLength,
      ( i * 2 + 0.5 ) / terrainTriLength,
      ( i * 2 + 0.5 ) / terrainTriLength,
      ( i * 2 + 1.5 ) / terrainTriLength,
      ( i * 2 + 1.5 ) / terrainTriLength,
      ( i * 2 + 1.5 ) / terrainTriLength
    );
  }
}

let vboTerrainUV = glCat.createVertexbuffer( terrainUV );
let vboTerrainTriIndex = glCat.createVertexbuffer( terrainTriIndex );

let textureTerrainUV = glCat.createTexture();
glCat.setTextureFromFloatArray( textureTerrainUV, 3, terrainTriLength, ( () => {
  let ret = new Float32Array( terrainTriLength * 3 * 4 );
  for ( let i = 0; i < terrainTriLength * 3; i ++ ) {
    ret[ i * 4     ] = terrainUV[ i * 2     ];
    ret[ i * 4 + 1 ] = terrainUV[ i * 2 + 1 ];
    ret[ i * 4 + 2 ] = 0.0;
    ret[ i * 4 + 3 ] = 1.0;
  }
  return ret;
} )() );

// ------

let textureDummy = glCat.createTexture();
glCat.setTextureFromArray( textureDummy, 1, 1, [ 1, 0, 1, 1 ] );

let textureRandomSize = 32;
let textureRandomUpdate = ( _tex ) => {
  glCat.setTextureFromArray( _tex, textureRandomSize, textureRandomSize, ( () => {
    let len = textureRandomSize * textureRandomSize * 4;
    let ret = new Uint8Array( len );
    for ( let i = 0; i < len; i ++ ) {
      ret[ i ] = Math.floor( xorshift() * 256.0 );
    }
    return ret;
  } )() );
};

let textureRandomStatic = glCat.createTexture();
glCat.textureWrap( textureRandomStatic, gl.REPEAT );
textureRandomUpdate( textureRandomStatic );

let textureRandom = glCat.createTexture();
glCat.textureWrap( textureRandom, gl.REPEAT );

// ------

let framebuffersGauss = [
  glCat.createFloatFramebuffer( width / 4, height / 4 ),
  glCat.createFloatFramebuffer( width / 4, height / 4 ),
  glCat.createFloatFramebuffer( width / 4, height / 4 )
];

let framebufferPreDof = glCat.createFloatFramebuffer( width, height );

let framebufferMotionPrev = glCat.createFramebuffer( width, height );
let framebufferMotionMosh = glCat.createFramebuffer( width, height );

let shadowSize = 512;

// ------

let bgColor = [ 0.0, 0.0, 0.0, 1.0 ];

// ------

glCatPath.setGlobalFunc( () => {
  glCat.uniform1i( "init", init );
  glCat.uniform1f( "time", automaton.time );
  glCat.uniform1f( "deltaTime", automaton.deltaTime );

  glCat.uniform1f( "frame", automaton.frame );
  glCat.uniform1f( "frames", frames );

  glCat.uniform2fv( "mouse", [ mouseX, mouseY ] );

  glCat.uniform3fv( "cameraPos", cameraPos );
  glCat.uniform3fv( "cameraTar", cameraTar );
  glCat.uniform1f( "cameraRoll", cameraRoll );
  glCat.uniform1f( "cameraFov", cameraFov );
  glCat.uniform1f( "cameraNear", cameraNear );
  glCat.uniform1f( "cameraFar", cameraFar );
  glCat.uniform3fv( "lightPos", lightPos );

  glCat.uniform1f( "particlesSqrt", particlesSqrt );
  glCat.uniform1f( "particlePixels", particlePixels );

  glCat.uniformMatrix4fv( "matP", matP );
  glCat.uniformMatrix4fv( "matV", matV );
  glCat.uniformMatrix4fv( "matPL", matPL );
  glCat.uniformMatrix4fv( "matVL", matVL );
  glCat.uniform4fv( "bgColor", bgColor );
} );

glCatPath.add( {
  return: {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/return.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 1.0 ],
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "sampler0", params.input, 0 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },

  inspector: {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/inspector.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 1.0 ],
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniform3fv( "circleColor", [ 1.0, 1.0, 1.0 ] );
      glCat.uniformTexture( "sampler0", params.input, 0 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },

  gaussTable: {
    width: 6, // radius of dof
    height: 256,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/gauss-table.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 1.0 ],
    framebuffer: true,
    float: true,
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },

  "🐬": {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/bg.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 1.0 ],
    framebuffer: true,
    drawbuffers: 2,
    float: true,
    func: () => {
      glCat.attribute( "p", vboQuad, 2 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },

  "影": {
    width: shadowSize,
    height: shadowSize,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/return.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ cameraFar, 0.0, 0.0, 1.0 ],
    framebuffer: true,
    drawbuffers: 2,
    float: true,
    func: () => {}
  },

  raymarch: {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/raymarch.frag" ),
    drawbuffers: 2,
    blend: [ gl.ONE, gl.ZERO ],
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      
      glCat.uniform1i( "isShadow", params.isShadow );
      if ( !params.isShadow ) {
        glCat.uniformTexture( "samplerShadow", glCatPath.fb( "影" ).textures[ 0 ], 0 );
      } else {
        glCat.uniformTexture( "samplerShadow", textureDummy, 0 );
      }
      
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },

  terrainCompute: {
    width: terrainSize,
    height: terrainSize,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/terrain-compute.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 0.0 ],
    framebuffer: true,
    float: true,
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "samplerRandom", textureRandom, 0 );
      glCat.uniformTexture( "samplerRandomStatic", textureRandomStatic, 1 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },

  terrainRender: {
    width: width,
    height: height,
    vert: glslify( "./shader/terrain-render.vert" ),
    frag: glslify( "./shader/g-buffer.frag" ),
    drawbuffers: 2,
    blend: [ gl.ONE, gl.ZERO ],
    func: ( path, params ) => {
      glCat.attribute( "uv", vboTerrainUV, 2 );
      glCat.attribute( "triIndex", vboTerrainTriIndex, 1 );
        
      let matM = MathCat.mat4Identity();
      glCat.uniformMatrix4fv( "matM", matM );

      glCat.uniformTexture( "samplerTerrain", glCatPath.fb( "terrainCompute" ).texture, 0 );
      glCat.uniformTexture( "samplerUV", textureTerrainUV, 1 );

      glCat.uniform1i( "isShadow", params.isShadow );

      glCat.uniform1i( "material", 1 );
      
      gl.drawArrays( gl.TRIANGLES, 0, vboTerrainUV.length / 2 );
    }
  },

  cube: {
    width: width,
    height: height,
    vert: glslify( "./shader/object.vert" ),
    frag: glslify( "./shader/g-buffer.frag" ),
    drawbuffers: 2,
    blend: [ gl.ONE, gl.ZERO ],
    func: ( path, params ) => {
      glCat.attribute( "pos", vboCubePos, 3 );
      glCat.attribute( "nor", vboCubeNor, 3 );
        
      let matM = MathCat.mat4Identity();
      matM = MathCat.mat4Apply( MathCat.mat4ScaleXYZ( 1.0 ), matM );
      matM = MathCat.mat4Apply( MathCat.mat4RotateZ( -auto( "cameraTheta" ) * Math.PI * 1.0 ), matM );
      matM = MathCat.mat4Apply( MathCat.mat4RotateX( auto( "cameraTheta" ) * Math.PI * 2.0 ), matM );
      matM = MathCat.mat4Apply( MathCat.mat4RotateY( -auto( "cameraTheta" ) * Math.PI * 1.0 ), matM );
      glCat.uniformMatrix4fv( "matM", matM );

      glCat.uniform1i( "isShadow", params.isShadow );

      glCat.uniform1i( "material", 2 );

      gl.drawArrays( gl.TRIANGLES, 0, vboCubePos.length / 3 );
    }
  },

  particlesComputeReturn: {
    width: particlesSqrt * particlePixels,
    height: particlesSqrt,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/return.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 0.0 ],
    framebuffer: true,
    float: true,
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "sampler0", glCatPath.fb( "particlesCompute" ).texture, 0 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },

  particlesCompute: {
    width: particlesSqrt * particlePixels,
    height: particlesSqrt,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/particles-compute.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 0.0 ],
    framebuffer: true,
    float: true,
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "samplerPcompute", glCatPath.fb( "particlesComputeReturn" ).texture, 0 );
      glCat.uniformTexture( "samplerRandom", textureRandom, 1 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },
  
  particlesRender: {
    width: width,
    height: height,
    vert: glslify( "./shader/particles-render.vert" ),
    frag: glslify( "./shader/g-buffer.frag" ),
    drawbuffers: 2,
    blend: [ gl.ONE, gl.ZERO ],
    func: ( path, params ) => {
      glCat.attribute( "computeUV", vboParticleUV, 2, 1 );
      glCat.attribute( "primPos", vboCubePos, 3 );
      glCat.attribute( "primNor", vboCubeNor, 3 );

      glCat.uniform2fv( "resolutionPcompute", [ particlesSqrt * particlePixels, particlesSqrt ] );
      glCat.uniformTexture( "samplerPcompute", glCatPath.fb( "particlesCompute" ).texture, 1 );

      glCat.uniform1i( "isShadow", params.isShadow );

      glCat.uniform1i( "material", 3 );

      let ext = glCat.getExtension( "ANGLE_instanced_arrays" );
      ext.drawArraysInstancedANGLE( gl.TRIANGLES, 0, vertsPerParticle, particles );
    }
  },
  
  shade: {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/shade.frag" ),
    clear: [ 0.0, 0.0, 0.0, 1.0 ],
    framebuffer: true,
    float: true,
    blend: [ gl.ONE, gl.ZERO ],
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "sampler0", glCatPath.fb( "🐬" ).textures[ 0 ], 0 );
      glCat.uniformTexture( "sampler1", glCatPath.fb( "🐬" ).textures[ 1 ], 1 );
      glCat.uniformTexture( "samplerShadow", glCatPath.fb( "影" ).textures[ 0 ], 2 );
      glCat.uniformTexture( "samplerRandom", textureRandom, 4 );
      
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },
  
  fxaa: {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/fxaa.frag" ),
    clear: [ 0.0, 0.0, 0.0, 1.0 ],
    framebuffer: true,
    float: true,
    blend: [ gl.ONE, gl.ZERO ],
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "sampler0", params.input, 0 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },
  
  gauss: {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/gauss.frag" ),
    clear: [ 0.0, 0.0, 0.0, 1.0 ],
    tempFb: glCat.createFloatFramebuffer( width, height ),
    blend: [ gl.ONE, gl.ZERO ],
    func: ( path, params ) => {
      if ( params.width && params.height ) {
        glCat.resizeFloatFramebuffer( path.tempFb, params.width, params.height );
      }

      gl.bindFramebuffer( gl.FRAMEBUFFER, path.tempFb.framebuffer );
      glCat.clear( ...path.clear );

      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "sampler0", params.input, 0 );
      glCat.uniform1f( "var", params.var );
      glCat.uniform1i( "isVert", 0 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
      
      gl.bindFramebuffer( gl.FRAMEBUFFER, params.framebuffer );

      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "sampler0", path.tempFb.texture, 0 );
      glCat.uniform1f( "var", params.var );
      glCat.uniform1i( "isVert", 1 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },
  
  "Gowrock - bloom": {
    width: width / 4.0,
    height: height / 4.0,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/bloom.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 0.0 ],
    tempFb: glCat.createFloatFramebuffer( width / 4.0, height / 4.0 ),
    framebuffer: true,
    float: true,
    func: ( path, params ) => {
      for ( let i = 0; i < 3; i ++ ) {
        let gaussVar = [ 1.0, 3.0, 10.0 ][ i ];
        gl.bindFramebuffer( gl.FRAMEBUFFER, path.tempFb.framebuffer );
        glCat.clear( ...path.clear );

        glCat.attribute( "p", vboQuad, 2 );
        glCat.uniform1i( "isVert", false );
        glCat.uniform1f( "gaussVar", gaussVar );
        glCat.uniformTexture( "sampler0", params.input, 0 );
        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
        
        gl.bindFramebuffer( gl.FRAMEBUFFER, params.framebuffer );

        glCat.attribute( "p", vboQuad, 2 );
        glCat.uniform1i( "isVert", true );
        glCat.uniform1f( "gaussVar", gaussVar );
        glCat.uniformTexture( "sampler0", path.tempFb.texture, 0 );
        glCat.uniformTexture( "samplerDry", params.input, 1 );
        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
      }
    }
  },
  
  bloomFinalize: {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/bloom-finalize.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 0.0 ],
    framebuffer: true,
    float: true,
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "samplerDry", params.dry, 0 );
      glCat.uniformTexture( "samplerWet", params.wet, 1 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },
  
  おたくはすぐポストエフェクトを挿す: {
    width: width,
    height: height,
    vert: glslify( "./shader/quad.vert" ),
    frag: glslify( "./shader/post.frag" ),
    blend: [ gl.ONE, gl.ZERO ],
    clear: [ 0.0, 0.0, 0.0, 0.0 ],
    framebuffer: true,
    func: ( path, params ) => {
      glCat.attribute( "p", vboQuad, 2 );
      glCat.uniformTexture( "sampler0", params.input, 0 );
      gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    }
  },
} );

// ------

let updateUI = () => {
  let now = new Date();
  let deadline = new Date( 2018, 2, 2, 0, 0 );

  divCountdown.innerText = "Deadline: " + Math.floor( ( deadline - now ) / 1000 );
};

// ------

glCatPath.render( "gaussTable" );

let update = () => {
  if ( !tweak.checkbox( "play", { value: true } ) ) {
    setTimeout( update, 100 );
    return;
  }

  automaton.update();

  if ( automaton.frame === 0 ) {
    xorshift( 179067891367 );
  }

  updateUI();
  updateMatrices();

  textureRandomUpdate( textureRandom );

  // ------

  glCatPath.begin();

  glCatPath.render( "🐬" );
  glCatPath.render( "影" );

  // ------

  glCatPath.render( "particlesComputeReturn" );
  glCatPath.render( "particlesCompute" );

  glCatPath.render( "terrainCompute" );

  // ------

  [
    "terrainRender",
    "raymarch"
  ].map( ( n ) => {
    glCatPath.render( n, {
      target: glCatPath.fb( "影" ),
      isShadow: true,
      width: shadowSize,
      height: shadowSize
    } );
  } );

  [
    "terrainRender",
    "raymarch",
    "particlesRender"
  ].map( ( n ) => {
    glCatPath.render( n, {
      target: glCatPath.fb( "🐬" ),
      isShadow: false
    } );
  } );

  glCatPath.render( "shade" );

  glCatPath.render( "gauss", {
    target: framebufferPreDof,
    input: glCatPath.fb( "shade" ).texture,
    width: width,
    height: height,
    var: 5.0
  } );

  glCatPath.render( "Gowrock - bloom", {
    input: framebufferPreDof.texture,
  } );
  glCatPath.render( "bloomFinalize", {
    dry: glCatPath.fb( "shade" ).texture,
    wet: glCatPath.fb( "Gowrock - bloom" ).texture
  } );

  glCatPath.render( "おたくはすぐポストエフェクトを挿す", {
    input: glCatPath.fb( "bloomFinalize" ).texture
  } );

  glCatPath.render( "fxaa", {
    target: GLCatPath.nullFb,
    input: glCatPath.fb( "おたくはすぐポストエフェクトを挿す" ).texture
  } );

  glCatPath.end();

  init = false;
  totalFrame ++;

  // ------

  if ( tweak.checkbox( "save", { value: false } ) ) {
    saveFrame();
  }

  requestAnimationFrame( update );
}

update();

// ------

window.addEventListener( "keydown", ( _e ) => {
  if ( _e.which === 27 ) {
    tweak.checkbox( "play", { set: false } );
  }
} );

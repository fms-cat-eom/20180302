#define saturate(i) clamp(i,0.,1.)

#extension GL_EXT_draw_buffers : require
precision highp float;

varying vec3 vPos;
varying vec3 vNor;

uniform vec3 cameraPos;
uniform vec3 lightPos;
uniform bool isShadow;

// ------

void main() {
  if ( isShadow ) {
    float depth = length( vPos - lightPos );
    gl_FragData[ 0 ] = vec4( depth, 0.0, 0.0, 1.0 );
    return;
  }

  float depth = length( vPos - cameraPos );

  gl_FragData[ 0 ] = vec4( vNor * 0.5 + 0.5, 1.0 );
  gl_FragData[ 1 ] = vec4( depth, 0.0, 0.0, 1.0 );
}
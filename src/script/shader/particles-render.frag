#define PARTICLE_LIFE_SPEED 2.0

#define HUGE 9E16
#define PI 3.14159265
#define V vec3(0.,1.,-1.)
#define saturate(i) clamp(i,0.,1.)

// ------

#extension GL_EXT_draw_buffers : require
precision highp float;

varying vec3 vPos;
varying vec3 vNor;
varying vec3 vPrimPos;
varying vec3 vPrimNor;
varying float vLife;
varying float vSize;
varying vec2 vShadowCoord;

uniform vec3 color;
uniform vec3 cameraPos;
uniform float cameraNear;
uniform float cameraFar;
uniform vec3 lightPos;
uniform float frame;

uniform bool isShadow;

uniform sampler2D samplerShadow;

// ------

float shadow( float d ) {
  float dc = length( vPos - lightPos );
  float ret = 0.0;
  for ( int iy = -1; iy <= 1; iy ++ ) {
    for ( int ix = -1; ix <= 1; ix ++ ) {
      vec2 uv = vShadowCoord + vec2( float( ix ), float ( iy ) ) * 0.001;
      float proj = texture2D( samplerShadow, uv ).x;
      float bias = 0.1 + ( 1.0 - d ) * 0.3;

      float dif = smoothstep( bias * 2.0, bias, ( dc - proj ) );
      ret += dif / 9.0;
    }
  }
  return ret;
}

void main() {
  if ( vLife <= 0.0 ) { discard; }

  if ( isShadow ) {
    float depth = length( vPos - lightPos );
    gl_FragData[ 0 ] = vec4( depth, 0.0, 0.0, 1.0 );
    return;
  }

  vec3 ld = normalize( vPos - lightPos );
  vec3 rd = normalize( vPos - cameraPos );
  vec3 hd = normalize( ld + rd );

  float sh = shadow( dot( -vNor, ld ) );

  vec3 col = 150.0 * vec3( 0.2 ) * (
    saturate( dot( -vNor, ld ) )
    / pow( length( vPos - lightPos ), 2.0 )
    * mix( 0.2, 1.0, sh )
  );

  col += vec3( 0.4 ) * (
    pow( saturate( dot( -vNor, hd ) ), 20.0 )
    * mix( 0.0, 1.0, sh )
  );

  float depth = length( vPos - cameraPos );

  gl_FragData[ 0 ] = vec4( col, 1.0 );
  gl_FragData[ 1 ] = vec4( depth, 0.0, 0.0, 1.0 );
}
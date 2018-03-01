#define RANDOM_TEXTURE_RESO 64.0
#define TERRAIN_SIZE 64.0

#pragma glslify: import( ./common.glsl )

precision highp float;

uniform float time;
uniform vec2 resolution;
uniform sampler2D samplerRandom;
uniform sampler2D samplerRandomStatic;

#pragma glslify: noise = require( ./noise )

vec3 iRandom( vec2 uv, vec2 rep ) {
  vec2 d = vec2( 0.0, 1.0 ) / RANDOM_TEXTURE_RESO;
  vec2 uvi = floor( uv * RANDOM_TEXTURE_RESO ) / RANDOM_TEXTURE_RESO;
  vec2 uvf = ( uv - uvi ) * RANDOM_TEXTURE_RESO;
  vec2 uvfs = vec2(
    smoothstep( 0.0, 1.0, uvf.x ),
    smoothstep( 0.0, 1.0, uvf.y )
  );

  vec3 v00 = texture2D( samplerRandomStatic, mod( uvi, rep ) ).xyz;
  vec3 v10 = texture2D( samplerRandomStatic, mod( uvi + d.yx, rep ) ).xyz;
  vec3 v01 = texture2D( samplerRandomStatic, mod( uvi + d.xy, rep ) ).xyz;
  vec3 v11 = texture2D( samplerRandomStatic, mod( uvi + d.yy, rep ) ).xyz;

  return mix(
    mix( v00, v10, uvfs.x ),
    mix( v01, v11, uvfs.x ),
    uvfs.y
  ) - 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 tuv = uv * ( TERRAIN_SIZE ) / ( TERRAIN_SIZE - 1.0 );

  vec3 pos = vec3( 0.0 );
  float r = 0.5 + 0.5 * sin( tuv.y * PI );
  float theta = tuv.x * PI * 2.0;
  pos.xy = r * 7.0 * vec2( cos( theta ), sin( theta ) );
  pos.z = 5.0 - 30.0 * tuv.y;

  for ( int i = 0; i < 4; i ++ ) {
    float m = 0.25 * pow( 2.0, float( i ) );
    float d = 0.125 + 0.5 * float( i );
    pos += r * iRandom( tuv * m + time * vec2( 0.0, d ), vec2( m, d ) ) / m;
  }

  gl_FragColor = vec4( pos, 1.0 );
}
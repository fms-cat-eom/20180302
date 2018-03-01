precision highp float;

#pragma glslify: import( ./common.glsl )
#pragma glslify: prng = require( ./prng )

#define AO_ITER 8
#define AO_BIAS 0.0
#define AO_RADIUS 0.5

#define FOG_DECAY 0.1
#define FOG_MARGIN 5.0

#define REFLECT_ITER 40
#define REFLECT_LENGTH 4.0
#define REFLECT_MARGIN 1.0

uniform float time;
uniform vec2 resolution;

uniform vec3 lightPos;
uniform vec3 cameraPos;
uniform vec4 bgColor;

uniform mat4 matV;
uniform mat4 matP;
uniform mat4 matVL;
uniform mat4 matPL;

uniform sampler2D sampler0;
uniform sampler2D sampler1;
uniform sampler2D samplerShadow;
uniform sampler2D samplerRandom;

vec3 randomSphere( inout vec4 seed ) {
  vec3 v;
  for ( int i = 0; i < 10; i ++ ) {
    v = vec3(
      prng( seed ),
      prng( seed ),
      prng( seed )
    ) * 2.0 - 1.0;
    if ( length( v ) < 1.0 ) { break; }
  }
  return v;
}

vec3 catColor( float _p ) {
  return 0.5 + 0.5 * vec3(
    cos( _p ),
    cos( _p + PI / 3.0 * 2.0 ),
    cos( _p + PI / 3.0 * 4.0 )
  );
}

float ambientOcclusion( vec3 pos, vec3 nor ) {
  float ao = 0.0;

  vec2 uv = gl_FragCoord.xy / resolution;
  vec4 seed = texture2D( samplerRandom, uv );

  for ( int i = 0; i < AO_ITER; i ++ ) {
    vec3 rnor = randomSphere( seed );
    if ( dot( rnor, nor ) < 0.0 ) { rnor = -rnor; }

    vec4 spos = matP * matV * vec4( pos + rnor * AO_RADIUS, 1.0 );
    vec2 suv = spos.xy / spos.w * 0.5 + 0.5;
    vec4 s0 = texture2D( sampler0, suv );

    vec3 dDir = s0.xyz - pos;
    if ( length( dDir ) < 1E-2 ) {
      ao += 1.0;
    } else {
      float dNor = dot( normalize( nor ), normalize( dDir ) );
      ao += 1.0 - saturate( dNor - AO_BIAS ) / ( length( dDir ) + 1.0 );
    }
  }

  ao = ao / float( AO_ITER );
  return ao;
}

float castShadow( vec3 pos, vec3 nor, float d ) {
  float shadow = 0.0;
  
  vec4 pFromLight = matPL * matVL * vec4( pos, 1.0 );
  vec2 uv = pFromLight.xy / pFromLight.w * 0.5 + 0.5;
  float dc = length( pos - lightPos );

  for ( int iy = -1; iy <= 1; iy ++ ) {
    for ( int ix = -1; ix <= 1; ix ++ ) {
      vec2 uvt = uv + vec2( float( ix ), float ( iy ) ) * 0.001;
      float proj = texture2D( samplerShadow, uvt ).x;
      float bias = 0.1 + ( 1.0 - d ) * 0.3;

      float dif = smoothstep( bias * 2.0, bias, ( dc - proj ) );
      shadow += dif / 9.0;
    }
  }

  return shadow;
}

float reflection( inout vec4 pos, inout vec4 nor, out float depth ) {
  vec3 d = reflect( normalize( pos.xyz - cameraPos ), nor.xyz );
  float l = 0.0;

  vec2 uv = gl_FragCoord.xy / resolution;
  vec4 seed = texture2D( samplerRandom, uv );
  prng( seed );

  for ( int i = 0; i < REFLECT_ITER; i ++ ) {
    l += prng( seed ) * 2.0 * REFLECT_LENGTH / float( REFLECT_ITER );
    vec3 p = pos.xyz + d * l;
    vec4 spos = matP * matV * vec4( p, 1.0 );
    vec2 suv = spos.xy / spos.w * 0.5 + 0.5;
    
    float ampUv = (
      smoothstep( 0.0, 0.1, suv.x ) * smoothstep( 1.0, 0.9, suv.x )
      * smoothstep( 0.0, 0.1, suv.y ) * smoothstep( 1.0, 0.9, suv.y )
    );
    if ( ampUv == 0.0 ) { break; }
    
    vec4 s0 = texture2D( sampler0, suv );

    float dp = length( cameraPos - p );
    float ds0 = length( cameraPos - s0.xyz );

    if ( 0.0 < dp - ds0 && dp - ds0 < REFLECT_MARGIN ) {
      depth = length( pos.xyz - s0.xyz );
      pos = s0;
      nor = texture2D( sampler1, suv );
      return ampUv;
    }
  }

  return 0.0;
}

vec3 shade( vec3 pos, vec3 nor, float material, inout float ref ) {
  vec3 ld = normalize( pos.xyz - lightPos );
  float d = dot( -nor.xyz, ld );

  float ao = ambientOcclusion( pos, nor );
  float shadow = castShadow( pos, nor, d );

  vec3 col = vec3( 0.0 );

  vec3 accentColor = catColor( pos.y * 0.07 + 0.4 );

  if ( material == 0.0 ) { // bg
    ref = 0.0;
    return bgColor.xyz;

  } else if ( material == 1.0 ) { // shade n edge
    vec2 uv = gl_FragCoord.xy / resolution;
    vec2 D = vec2( 0.0, 0.004 );
    float edge = (
      length( ( texture2D( sampler1, uv + D.yx ) - texture2D( sampler1, uv - D.xx ) ).xyz )
      + length( ( texture2D( sampler1, uv + D.xy ) - texture2D( sampler1, uv - D.xx ) ).xyz )
    );
    edge = smoothstep( 0.01, 0.1, edge );

    col = 10.0 * vec3( 0.6, 0.8, 1.0 ) * (
      saturate( 0.5 + 0.5 * d )
      / pow( length( pos - lightPos ), 2.0 )
      * mix( 0.3, 1.0, shadow )
      * ao
    );
    col += mix(
      col,
      0.4 * accentColor,
      edge
    ); 

    ref *= mix( 0.1, 0.0, edge );

  } else if ( material == 2.0 ) { // shade, with reflection
    col = 4.0 * vec3( 0.6, 0.8, 1.0 ) * (
      saturate( 0.5 + 0.5 * d )
      / pow( length( pos - lightPos ), 2.0 )
      * mix( 0.3, 1.0, shadow )
      * ao
    );
    col += 2.0 * accentColor * (
      exp( -5.0 * abs( d ) )
    );
    ref *= 0.7;

  } else if ( material == 3.0 ) { // glow
    float k = 0.5 + 0.5 * dot( -nor, normalize( pos - cameraPos ) );
    col = 15.0 * accentColor * k;

    ref = 0.0;
    
  }
  
  float blend = smoothstep( -0.01, 0.01, sin( time * PI * 2.0 + pos.z * 0.2 ) );
  vec3 col2 = 1.0 * vec3( 0.6, 0.8, 1.0 ) * (
    saturate( 0.9 + 0.1 * d )
    * mix( 0.9, 1.0, shadow )
    * ao
  );
  col = mix( col, col2, blend );
  ref *= 1.0 - blend;

  return col;
}

vec3 fog( vec3 col, float depth ) {
  return mix( bgColor.xyz, col, exp( -FOG_DECAY * max( 0.0, depth - FOG_MARGIN ) ) );
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;

  vec4 pos = texture2D( sampler0, uv );
  vec4 nor = texture2D( sampler1, uv );

  vec3 col = vec3( 0.0 );
  float ref = 1.0;

  float depth = length( cameraPos - pos.xyz );

  for ( int i = 0; i < 2; i ++ ) {
    float tref = ref;
    col += tref * fog( shade( pos.xyz, nor.xyz, nor.w, ref ), depth );
    if ( ref == 0.0 ) { break; }

    float r = reflection( pos, nor, depth );
    col += ref * ( 1.0 - r ) * bgColor.xyz;
    if ( r == 0.0 ) { break; }
    ref *= r;
  }

  gl_FragColor = vec4( col, 1.0 );
}

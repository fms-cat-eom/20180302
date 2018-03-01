#define MARCH_ITER 60
#define MARCH_MULT 0.7

#define PI 3.14159265
#define saturate(i) clamp(i,0.,1.)
#define lofi(i,m) (floor((i)/(m))*(m))

#extension GL_EXT_frag_depth : require
#extension GL_EXT_draw_buffers : require
precision highp float;

uniform float time;
uniform vec2 resolution;
uniform vec3 color;

uniform vec3 cameraPos;
uniform vec3 cameraTar;
uniform float cameraFov;
uniform float cameraNear;
uniform float cameraFar;
uniform float cameraRoll;
uniform vec3 lightPos;

uniform float circleRotate;
uniform float circleExpand;
uniform float circleInterval;

uniform mat4 matPL;
uniform mat4 matVL;

uniform bool isShadow;

// ------

mat2 rotate2D( float _t ) {
  return mat2(
    cos( _t ), sin( _t ),
    -sin( _t ), cos( _t )
  );
}

float random( vec2 _uv ) {
  return fract( sin( dot( vec2( 12.563, 21.864 ), _uv ) ) * 194.5134 );
}

// smooth minimum : http://iquilezles.org/www/articles/smin/smin.htm
float smin( float _a, float _b, float _k ) {
  float h = clamp( 0.5 + 0.5 * ( _b - _a ) / _k, 0.0, 1.0 );
  return mix( _b, _a, h ) - _k * h * ( 1.0 - h );
}

// ------

struct Camera {
  vec3 pos;
  vec3 dir;
  vec3 sid;
  vec3 top;
};

struct Ray {
  vec3 dir;
  vec3 ori;
};

// ------

Camera camInit( in vec3 _pos, in vec3 _tar, in float _roll ) {
  Camera cam;
  cam.pos = _pos;
  cam.dir = normalize( _tar - _pos );
  cam.sid = normalize( cross( cam.dir, vec3( 0.0, 1.0, 0.0 ) ) );
  cam.top = normalize( cross( cam.sid, cam.dir ) );
  cam.sid = cos( _roll ) * cam.sid + sin( _roll ) * cam.top;
  cam.top = normalize( cross( cam.sid, cam.dir ) );

  return cam;
}

Ray rayInit( in vec3 _ori, in vec3 _dir ) {
  Ray ray;
  ray.dir = _dir;
  ray.ori = _ori;
  return ray;
}

Ray rayFromCam( in vec2 _p, in Camera _cam, in float _fov ) {
  vec3 dir = normalize(
    _p.x * _cam.sid
    + _p.y * _cam.top
    + _cam.dir / tan( _fov * PI / 360.0 )
  );
  return rayInit( _cam.pos, dir );
}

// ------

float distFuncSphere( vec3 _p, float _r ) {
  return length( _p ) - _r;
}

float distFuncBox( vec3 _p, vec3 _s ) {
  vec3 d = abs( _p ) - _s;
  return min( max( d.x, max( d.y, d.z ) ), 0.0 ) + length( max( d, 0.0 ) );
}

vec3 circleRep( vec3 _p, float _r, float _c ) {
  vec3 p = _p;
  float intrv = PI * 2.0 / _c;
  p.zx = rotate2D( floor( atan( p.z, p.x ) / intrv ) * intrv ) * p.zx;
  p.zx = rotate2D( intrv / 2.0 ) * p.zx;
  p.x -= _r;
  return p;
}

float distFunc( vec3 _p ) {
  float dist = 1E9;

  { // metaball
    vec3 p = _p;
    for ( int i = 0; i < 5; i ++ ) {
      float fi = float( i );
      #define S(x) sin( PI * 2.0 * ( time * floor( 1.0 + 3.0 * random( vec2( fi * 3.96, x ) ) ) + random( vec2( fi * 2.81, x ) ) ) )
      vec3 tra = 1.2 * vec3(
        S( 18.42 ),
        S( 21.71 ),
        S( 23.49 )
      );
      #undef S
      dist = smin( dist, distFuncSphere( p - tra, 0.8 ), 1.0 );
    }

    p = _p;
    float s = 0.6;
    p.y = mod( p.y, s ) - s / 3.0;
    dist = max( dist, abs( p.y ) - s / 4.0 );
  }

  return dist;
}

vec3 normalFunc( in vec3 _p ) {
  vec2 d = vec2( 0.0, 1.0 ) * 1E-4;
  return normalize( vec3(
    distFunc( _p + d.yxx ) - distFunc( _p - d.yxx ),
    distFunc( _p + d.xyx ) - distFunc( _p - d.xyx ),
    distFunc( _p + d.xxy ) - distFunc( _p - d.xxy )
  ) );
}

// ------

void main() {
  vec2 p = ( gl_FragCoord.xy * 2.0 - resolution ) / resolution.y;

  Camera cam = camInit( cameraPos, cameraTar, cameraRoll );
  if ( isShadow ) { cam = camInit( lightPos, cameraTar, 0.0 ); }
  Ray ray = rayFromCam( p, cam, cameraFov );

  float rayLen = cameraNear;
  vec3 rayPos = ray.ori + rayLen * ray.dir;
  float dist = 0.0;

  for ( int i = 0; i < MARCH_ITER; i ++ ) {
    dist = distFunc( rayPos );
    rayLen += dist * MARCH_MULT;
    rayPos = ray.ori + rayLen * ray.dir;

    if ( cameraFar < rayLen ) { break; }
    if ( abs( dist ) < 1E-5 ) { break; }
  }

  if ( 1E-2 < dist ) { discard; }

  if ( isShadow ) {
    float depth = length( rayPos - lightPos );
    gl_FragData[ 0 ] = vec4( depth, 0.0, 0.0, 1.0 );

    {
      float a = ( cameraFar + cameraNear ) / ( cameraFar - cameraNear );
      float b = 2.0 * cameraFar * cameraNear / ( cameraFar - cameraNear );
      float z = dot( cam.dir, rayPos - cam.pos );
      gl_FragDepthEXT = ( a - b / z ) * 0.5 + 0.5;
    }
    return;
  }

  vec3 nor = normalFunc( rayPos );

  float mtl = 2.0;

  gl_FragData[ 0 ] = vec4( rayPos, rayLen );
  gl_FragData[ 1 ] = vec4( nor, mtl );

  {
    float a = ( cameraFar + cameraNear ) / ( cameraFar - cameraNear );
    float b = 2.0 * cameraFar * cameraNear / ( cameraFar - cameraNear );
    float z = dot( cam.dir, rayPos - cam.pos );
    gl_FragDepthEXT = ( a - b / z ) * 0.5 + 0.5;
  }
}

#ifndef _DEFINEJS_CHILD_
#define _DEFINEJS_CHILD_

#include <v8.h>
#include <node.h>

namespace defjs {
  void Initialize( v8::Handle<v8::Object> target );
  v8::Handle<v8::Value> CallSync( const v8::Arguments &args );
  v8::Handle<v8::Value> CallSync( const char *file, char *const argv[], const char *cwd, char **env );
}

#endif

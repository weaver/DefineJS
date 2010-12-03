#include "_defjs.h"

#include <node.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>

# ifdef __APPLE__
# include <crt_externs.h>
# define environ (*_NSGetEnviron())
# else
extern char **environ;
# endif

using namespace v8;
using namespace node;

extern "C" {
  void init( Handle<Object> target ) {
    HandleScope scope;
    defjs::Initialize(target);
  }
}

#define THROW_ERROR(message) ThrowException(Exception::Error(String::New(message)));

namespace defjs {

  void Initialize( Handle<Object> target ) {
    HandleScope scope;

    Local<FunctionTemplate> tpl = FunctionTemplate::New(CallSync);
    target->Set( String::NewSymbol( "callSync" ), tpl->GetFunction() );
  }

  // ## CallSync ##
  //
  // This implementation is adapted from Node's
  // ChildProcess::Spawn(). CallSync(args) is almost the identical to
  // Node's. CallSync(file, ...) uses vfork() and execve() like Node,
  // but the parent blocks with a waitpid() and returns the child's
  // exit code.

  Handle<Value> CallSync( const Arguments &args ) {
    HandleScope scope;

    if (args.Length() < 4    ||
	!args[0]->IsString() ||
	!args[1]->IsArray()  ||
	!args[2]->IsString() ||
	!args[3]->IsArray()) {
      return THROW_ERROR("Bad argument.");
    }

    // (1) Program Name
    String::Utf8Value file(args[0]->ToString());

    // (2) Arguments
    int i;
    Local<Array> argv_handle = Local<Array>::Cast(args[1]);
    int argc = argv_handle->Length();
    int argv_length = argc + 2;           // Note: +2
    char **argv = new char*[argv_length];

    argv[0] = strdup(*file);              // +1
    argv[argv_length - 1] = NULL;         // +1

    for (i = 0; i < argc; i++) {
      String::Utf8Value arg(argv_handle->Get(Integer::New(i))->ToString());
      argv[i + 1] = strdup(*arg);
    }

    // (3) Current Working Directory
    String::Utf8Value arg(args[2]->ToString());
    char *cwd = strdup(*arg);

    // (4) Environment
    Local<Array> env_handle = Local<Array>::Cast(args[3]);
    int envc = env_handle->Length();
    char **env = new char*[envc + 1];
    env[envc] = NULL;

    for (i = 0; i < envc; i++) {
      String::Utf8Value pair(env_handle->Get(Integer::New(i))->ToString());
      env[i] = strdup(*pair);
    }

    // Ready: Spawn
    Handle<Value> result = CallSync(argv[0], argv, cwd, env);

    // Clean Up
    for (i = 0; i < argv_length; i++) free(argv[i]);
    delete [] argv;

    for (i = 0; i < envc; i++) free(env[i]);
    delete [] env;

    return result;
  }

  Handle<Value> CallSync(const char *file,
			  char *const args[],
			  const char *cwd,
			  char **env) {

    HandleScope scope;
    pid_t pid_;
    char **parent_env = environ;

    switch (pid_ = vfork()) {
    case -1: // Error!
      return Integer::New(-4);

    case 0:  // Child.
      if (strlen(cwd) && chdir(cwd)) {
	perror("chdir()");
	_exit(127);
      }

      environ = env;

      execvp(file, args);
      perror("execvp()");
      _exit(127);
    }

    // Parent.
    environ = parent_env;

    int status;
    waitpid(pid_, &status, 0);

    if ( WIFEXITED(status) ) {
      return Integer::New(WEXITSTATUS(status));
    }
    else if ( WIFSIGNALED(status) ) {
      return THROW_ERROR("Child terminated by signal.");
    }

    return THROW_ERROR("Child exited abnormally.");
  }

}


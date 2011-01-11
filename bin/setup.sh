#!/bin/sh

zero=`python -c "import os; print os.path.realpath('$0')"`
here=`dirname $zero`
base=`dirname $here`

script="$base/bin/defjs"
dest=/usr/local/bin/defjs

## Install DefineJS ##

set -x

sudo ln -sf $script $dest

set +x

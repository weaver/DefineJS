#!/bin/sh

zero=`python -c "import os; print os.path.realpath('$0')"`
here=`dirname $zero`
base=`dirname $here`

scripts="$base/bin"
dest="/usr/local/bin"

## Install DefineJS ##

set -x

for name in defjs redef; do
    sudo ln -sf $scripts/$name $dest/$name
done

set +x

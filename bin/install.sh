#!/bin/sh

temp="/tmp/DefineJS"
dest="/usr/local/DefineJS"

set -x

if [ -d $dest ]; then
  cd $dest
  git fetch && git merge origin/master
else
  rm -rf $temp
  git clone git://github.com/weaver/DefineJS.git $temp
  sudo rm -rf $dest
  sudo mv $temp $dest
fi

(cd $dest && make && make setup)
echo "DefineJS installation finished."

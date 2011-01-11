all:
	@echo 'Updating submodules'
	git submodule update --init

	@echo 'Compiling native extension.'
	node-waf configure build

setup:
	./bin/setup.sh


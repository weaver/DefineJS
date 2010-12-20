all:
	@echo 'Updating submodules'
	git submodule update --init

	@echo 'Compiling native extension.'
	node-waf configure build

install:
	@echo 'Linking `defjs` include /usr/local/bin...'
	@echo 'I may ask for your sudo password.'
	sudo ln -sf `python -c 'import os;print os.path.realpath("bin/defjs")'` /usr/local/bin/defjs
	@echo 'Done.'
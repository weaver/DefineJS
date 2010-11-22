all:
	@echo 'Compiling native extension.'
	node-waf configure build

install:
	@echo 'Linking `defnode` include /usr/local/bin...'
	@echo 'I may ask for your sudo password.'
	sudo ln -sf `readlink -f bin/defnode` /usr/local/bin/defnode
	@echo 'Done.'
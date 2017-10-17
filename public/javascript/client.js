window.onload = () => {
	const toServer = io()

	doc = ''
	old_user_name_value = ''
	old_password_value = ''
	user_name = ''
	password = ''
	login = ''
	main_menu = ''
	name = ''
	disconnected = false

	clickable_hashmap = []
	current_leaderboard = []
	limit_leaderboard = 100

	disconnect_msg = "Disconnected with server. Refresh and login again to continue"
	num_questions = 10

	var code = ""; var file_name = "";

	toServer.on('connect', () => {
		print("Connected.")

		doc = $('body')
		user_name = $('#user_name')
		password = $('#password')
		login = $('#login')

		old_user_name_value = user_name.val(); old_password_value = password.val();

		user_name.on('keyup', (e) => {
			if (e.keyCode == 13)
				check_and_login(user_name, password, toServer)
		})

		password.on('keyup', (e) => {
			if (e.keyCode == 13)
				check_and_login(user_name, password, toServer)
		})

		login.on('click', () => {
			check_and_login(user_name, password, toServer)
		})
	})

	toServer.on('update_leaderboard', leaderboard => {
		current_leaderboard = leaderboard
		update_leaderboard()
	})

	toServer.on('disconnect', () => {
		print('Disconnected with server')
		$('#server_says').prop('innerHTML', disconnect_msg)
		disconnected = true
	})

	toServer.on('reg_failed', inc_msg => {
		$('#server_says').prop('innerHTML', inc_msg)
	})

	toServer.on('reg_successful', info => {
		main_menu = info[0]; name = info[1]; user_name = info[2]
		ready_main_menu()
	})

	toServer.on('question_page', details => {
		var question_num = details[0]
		var question_page = details[1]
		ready_question_page(question_num, question_page)
	})

	toServer.on('clickable_hashmap', map => {
		clickable_hashmap = map
		for (var i=1; i<=num_questions; i++) {
			$('#q'+i.toString()+'_status').prop('innerHTML', clickable_hashmap['q'+i.toString()][1])
		}
	})

	toServer.on('set_num_questions', number => {
		num_questions = number
	})

	function check_and_login(user_name_, password_, sock) {
		if (has_changed(old_user_name_value, user_name_.val()) || has_changed(old_password_value, password_.val())) {
			old_user_name_value = user_name_.val(); old_password_value = password_.val();
			sock.emit('reg_check', [user_name_.val(), password_.val()])
		}
	}

	function update_leaderboard() {
		var board_in_html = '<b><ol>\n'
		for (var i=0; i<current_leaderboard.length; i++) {
			if (i==limit_leaderboard)
				break
			board_in_html+= "<li>" + current_leaderboard[i]['user_name'] + ' - ' + current_leaderboard[i]['names'] + "</li></br>"
		}
		board_in_html+='</ol></b>'
		$('#leader_board').prop('innerHTML', board_in_html)
	}

	function ready_main_menu () {
		doc.prop('innerHTML', main_menu)
		document.title = 'Welcome();'
		$('#name').prop('innerHTML', "Welcome " + name)

		var all_go_tos_ = [];

		for (var i=1; i<=num_questions; i++) {
			$('#q'+i.toString()+'_status').prop('innerHTML', clickable_hashmap['q'+i.toString()][1])
			all_go_tos_.push({question_num: i, button: $('#q'+i.toString()+'_go_to')})
		}

		all_go_tos_.forEach( go_to => {
			go_to['button'].click( () => {
				if (!disconnected)
					toServer.emit('question_start', [user_name, go_to['question_num']])
			})
		})
		print("Main menu set and ready")
	}

	function ready_question_page(q_num, page) {
		// file_name = ""; code = "";
		doc.prop('innerHTML', page)
		document.title = 'Question_' + q_num.toString() + '();'
		if (!clickable_hashmap['q'+q_num.toString()][0]) {
			$('#q'+q_num.toString()+'_file').prop('disabled', true)
			$('#q'+q_num.toString()+'_upload').prop('disabled', true)
		}

		// document.getElementById('q'+q_num.toString()+'_file').addEventListener('change', readFile, false);

		$('#back').click( () => {
			ready_main_menu()
		})

		$('#q'+q_num.toString()+'_upload').click( () => {
			var temp = document.getElementById('q'+q_num.toString()+'_file')
			var file = temp.files[0]
			var reader = new FileReader()
			reader.onload = function() {
				file_name = file.name
				code = this.result
				if (clickable_hashmap['q'+q_num.toString()][0]) {
					if (code!='' && file_name!='') {
						if (!contains_special_characters(file_name)) {
							$('#error_msg').prop('innerHTML', '')
							toServer.emit('question_end', [user_name, q_num, file_name, code])

							$('#q'+q_num.toString()+'_file').prop('disabled', true)
							$('#q'+q_num.toString()+'_upload').prop('disabled', true)
						} else {
							$('#error_msg').prop('innerHTML', 'File Name cannot have a / character')
						}
					} else {
						if (code=='') {
							$('#error_msg').prop('innerHTML', 'Code cannot be empty')
						} else if (file_name=='') {
							$('#error_msg').prop('innerHTML', 'File Name cannot be empty')
						}
					}
				}
			}
			if (file==null)
				$('#error_msg').prop('innerHTML', 'You must select a file')
			else
				reader.readAsText(file)
		})

		update_leaderboard()

		print("Question page set and ready")
	}

	function contains_special_characters(name_) {
		if (name_.search("/")!=-1)
			return true
		return false
	}

	function has_changed(old_, new_) {
		if (new_!=old_)
			return true
		else
			return false
	}

	function print(to_print) {
		console.log(to_print)
	}
}

/*function ready_question_page(q_num, page) {
	doc.prop('innerHTML', page)
	document.title = 'Question_' + q_num.toString() + '();'
	if (!clickable_hashmap['q'+q_num.toString()][0]) {
		$('#q'+q_num.toString()+'_code').prop('disabled', true)
		$('#q'+q_num.toString()+'_file_name').prop('disabled', true)
		$('#q'+q_num.toString()+'_upload').prop('disabled', true)
	}

	$('#back').click( () => {
		ready_main_menu()
	})

	$('#q'+q_num.toString()+'_upload').click( () => {
		if (clickable_hashmap['q'+q_num.toString()][0]) {
			code =$('#q'+q_num.toString()+'_code').prop('value')
			file_name = $('#q'+q_num.toString()+'_file_name').prop('value')
			if (code!='' && file_name!='') {
				if (!contains_special_characters(file_name)) {
					$('#error_msg').prop('innerHTML', '')
					toServer.emit('question_end', [user_name, q_num, file_name, code])

					$('#q'+q_num.toString()+'_code').prop('disabled', true)
					$('#q'+q_num.toString()+'_file_name').prop('disabled', true)
					$('#q'+q_num.toString()+'_upload').prop('disabled', true)
				} else {
					$('#error_msg').prop('innerHTML', 'File Name cannot have a / character')
				}
			} else {
				if ($('#q'+q_num.toString()+'_code').prop('value')==='') {
					$('#error_msg').prop('innerHTML', 'Code cannot be empty')
				} else if ($('#q'+q_num.toString()+'_file_name').prop('value')==='') {
					$('#error_msg').prop('innerHTML', 'File Name cannot be empty')
				}
			}
		}
	})

	update_leaderboard()

	print("Question page set and ready")
}*/

/*function readFile (evt) {
	var files = evt.target.files;
	var file = files[0];
	var reader = new FileReader();
	reader.onload = function() {
		file_name = file.name;
		code = this.result;
	}
	reader.readAsText(file)
}*/
/*10.101.96.24*/

express = require('express')
bodyParser = require('body-parser')
path = require('path')
fs = require('fs')
http = require('http');
ejs = require('ejs');
prompt = require('prompt');
execute = require('child_process').exec;
readline = require('readline');

rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// Globals
PORT = 3000
PORT = process.env.PORT || 3000; // this line added so port binds to heroku's port

app = express()
static_dir = 'public'
default_score = 60000

// Server specific globals:
progresses = {}
username_socket_map = {}
connectees = []
to_be_checked = []

home_dir = 'Submissions'
scoring_dir = "Scoring_outputs"
input_files_dir = "Inputs"
delim = "/"
progresses_file_name = 'all_progresses.txt'
leaderboard_file_name = 'leaderboard.txt'

timeout_duration = 60
database = []

execute("python extract_reg_info.py", (error, stdout, stderr) => {
	if (error) {
		print(stderr)
	} else {
		database = build_database(fs.readFileSync('database.txt', 'utf8'))
	}
})
main_menu_page = (ejs.compile(fs.readFileSync('./views/main_menu.ejs', 'utf8')))({})
q1_page = (ejs.compile(fs.readFileSync('./views/q1.html', 'utf8')))({})
q2_page = (ejs.compile(fs.readFileSync('./views/q2.html', 'utf8')))({})
q3_page = (ejs.compile(fs.readFileSync('./views/q3.html', 'utf8')))({})
q4_page = (ejs.compile(fs.readFileSync('./views/q4.html', 'utf8')))({})

all_pages = [q1_page, q2_page, q3_page, q4_page]
num_questions = all_pages.length
num_attr_per_question = 6
num_attr_per_user =  1 + num_questions*num_attr_per_question

new_line_delim = "\t\t*NL*\n"
new_prog_delim = "New_Progresses_Instance:"

/* Todo: when updating number of questions, change
	-> read new questions and add in the array of all_pages
	-> add_new_progress
	-> extract_progresses?
	-> default num_questions in client.js and main_menu.ejs */

server = http.createServer(app);
io = require('socket.io').listen(server);
server.listen(PORT, "0.0.0.0", () => {
	// print('Server started')

	progresses = extract_progresses(progresses_file_name)
	to_be_checked = extract_to_be_checked_from_progresses()
	// print("Progresses retrieved and repopulated.")
	// print(progresses)
})

// View Engine
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Body Parser middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

// Set static path
app.use(express.static(path.join(__dirname, static_dir)))

app.get('*', (req, res) => {
	if (req.url==='/') {
		res.render('login')
	}
})

keep_asking_user("Enter \"next\" to get next candidate to score.\nEnter \"Enter <username>:<Q#>:0/1\" for scoring a candidate.\n")

io.on('connection', socket => {
	socket.on('reg_check', credentials => {
		var user_name_reg_check = credentials[0]
		var pass = credentials[1]
		var result = in_database(user_name_reg_check, pass)
		if (!result[0])
			socket.emit('reg_failed', 'Username or Password incorrect')
		else {
			// result[1] contains names e.g. Ahsan && Babar
			if (!in_username_socket_map(user_name_reg_check)) {
				username_socket_map[user_name_reg_check] = socket
				if (!in_progresses(user_name_reg_check)) {
					add_new_progress(user_name_reg_check)
				}
				socket.emit('set_num_questions', num_questions)
				socket.emit('clickable_hashmap', make_hashmap(user_name_reg_check))
				// print("names: "+result[1])
				socket.emit('reg_successful', [main_menu_page, result[1], user_name_reg_check])
				socket.emit('update_leaderboard', make_leaderboard())
				setup_user_dirs(user_name_reg_check)
				copy_all_input_files(user_name_reg_check)
				connectees.push(socket)
			} else {
				socket.emit('reg_failed', 'You already have one instance open.')
				print(user_name_reg_check + " tried to login from two active places.")
			}
		}
	})

	socket.on('disconnect', () => {
		// print('Disconnected with client')
		remove_from_connectees(socket)
		// remove socket from list of active users
		var keys = Object.keys(username_socket_map)
		for (var i=0; i<keys.length; i++) {
			if (socket == username_socket_map[keys[i]]) {
				// print(keys[i] + " disconnected")
				delete username_socket_map[keys[i]]
				break
			}				
		}
	})

	socket.on('question_start', arr => {
		var user_name_qs = arr[0]
		var q_num_qs = arr[1]

		if (progresses[user_name_qs]['q'+q_num_qs.toString()+'_start']==-1) {
			progresses[user_name_qs]['q'+q_num_qs.toString()+'_start'] = get_current_time()
		}
		socket.emit('question_page', [q_num_qs, all_pages[q_num_qs-1]])
		socket.emit('clickable_hashmap', make_hashmap(user_name_qs))
		serialize()
	})

	socket.on('question_end', arr => {
		var user_name_qe = arr[0]; var q_num_qe = arr[1]
		var file_name_qe = arr[2]; var code_qe = arr[3]

		if (progresses[user_name_qe]['q'+q_num_qe.toString()+'_end']==-1) {
			print("Started checking " + user_name_qe + "'s question " + q_num_qe)
			var time_recorded = get_current_time()
		
			fs.writeFileSync(path.join(__dirname, home_dir, user_name_qe, 'q'+q_num_qe, file_name_qe), code_qe)
			socket.emit('clickable_hashmap', make_hashmap(user_name_qe))
			serialize()
			to_be_checked.push(user_name_qe + ";_;" + q_num_qe)

			/*Code for checking starts here*/
			var a = compile_and_run_promisified(user_name_qe, q_num_qe, file_name_qe)
			a.then( output => {
				// print("OUTPUT from compile_and_run_promisified : " + output)
				// score here according to the output
				var b = get_score_promisified(user_name_qe, q_num_qe, output)
				b.then( score => {
					// print("OUTPUT from get_score_promisified : " + score)
					if (score.search("MY_ERROR:")!=-1) {
						print("Error in running checking script : " + score)

						progresses[user_name_qe]['q'+q_num_qe.toString()+'_score'] = "Incorrect"
						progresses[user_name_qe]['q'+q_num_qe.toString()+'_end'] = time_recorded
						progresses[user_name_qe]['q'+q_num_qe.toString()+'_file_name'] = file_name_qe
						progresses[user_name_qe]['q'+q_num_qe.toString()+'_code'] = code_qe
						progresses[user_name_qe]['q'+q_num_qe.toString()+'_time_spent'] = progresses[user_name_qe]['q'+q_num_qe.toString()+'_end']-progresses[user_name_qe]['q'+q_num_qe.toString()+'_start']
					} else {
						score = score.replace("SCORE:\n","")
						var pieces = score.split("\n")

						var is_correct = parseInt(pieces[0].trim())

						if (is_correct==0) {
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_score'] = "Incorrect"
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_end'] = time_recorded
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_file_name'] = file_name_qe
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_code'] = code_qe
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_time_spent'] = progresses[user_name_qe]['q'+q_num_qe.toString()+'_end']-progresses[user_name_qe]['q'+q_num_qe.toString()+'_start']
						}
						else {
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_score'] = "Correct"
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_end'] = time_recorded
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_file_name'] = file_name_qe
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_code'] = code_qe
							progresses[user_name_qe]['q'+q_num_qe.toString()+'_time_spent'] = progresses[user_name_qe]['q'+q_num_qe.toString()+'_end']-progresses[user_name_qe]['q'+q_num_qe.toString()+'_start']
						}
					}
					remove_from_to_be_checked(user_name_qe+";_;"+q_num_qe)
					socket.emit('clickable_hashmap', make_hashmap(user_name_qe))
					serialize()

					// calculate new leaderboard and emit to everyone
					broadcast_leaderboard()
					print("Finished checking " + user_name_qe + "'s question " + q_num_qe)
				})
			})
		}
		/*Code for checking ends here*/
	})
})

function keep_asking_user(to_ask) {
	var answer = ""
	rl.question(to_ask, (answer) => {
		if (answer.search("next")!=-1) { // print("You asked for next student")
			var count = 0
			for (var i = 0; i < to_be_checked.length; i++) {
				if (count == 1) {
					break;
				}
				count+=1;
				var info = to_be_checked[i]
				var pieces = info.split(";_;")
				print(pieces[0] + " : " + pieces[1])
			}
			keep_asking_user(to_ask)
		} else { // print("You wanna enter score of some student")
			/*	if nickname is already scored, give a warning
				else update score and send updated leaderboard to everyone
				serialize progresses */
			var pieces = answer.split(":")
			if (pieces.length!=3) {
				print("Wrong input format")
				keep_asking_user(to_ask)
			}
			else {
				var nickname_entered = pieces[0]
				var q_num_entered = pieces[1]
				var score_entered = pieces[2];
				if (!in_progresses(nickname_entered)) {
					print(nickname_entered + " doesn't exist in progresses")
					keep_asking_user(to_ask)
				} else {
					if ( (parseInt(q_num_entered)>num_questions) || (parseInt(q_num_entered)<1) || ( (q_num_entered.length)>1) ) {
						print("Entered invalid question number")
						keep_asking_user(to_ask)
					} else {
						if (progresses[nickname_entered]['q'+q_num_entered+'_end']==-1) {
							print(nickname_entered + " hasn't finished this question yet.")
							keep_asking_user(to_ask)
						} else {
							if (progresses[nickname_entered]['q'+q_num_entered+'_score']!="Unmarked") {
								// give warning and ask for yes/no
								var will = ""
								rl.question(nickname_entered + " has already been marked for this question. Are you sure you wanna mark again(yes/no)?\n", (will) => {
									if (will.search("yes")!=-1) {
										if (score_entered.search("0")!=-1) {
											remove_from_to_be_checked(nickname_entered+";_;"+q_num_entered)
											progresses[nickname_entered]['q'+q_num_entered+'_score'] = "Incorrect"
											broadcast_leaderboard()
											serialize()
										} else if (score_entered.search("1")!=-1) {
											remove_from_to_be_checked(nickname_entered+";_;"+q_num_entered)
											progresses[nickname_entered]['q'+q_num_entered+'_score'] = "Correct"
											broadcast_leaderboard()
											serialize()
										} else {
											print("You entered invalid score. (Should be 0 or 1)")
										}
									}
									keep_asking_user(to_ask)
								})
							} else if (score_entered.search("0")!=-1) {
								remove_from_to_be_checked(nickname_entered+";_;"+q_num_entered)
								progresses[nickname_entered]['q'+q_num_entered+'_score'] = "Incorrect"
								broadcast_leaderboard()
								serialize()
							} else if (score_entered.search("1")!=-1) {
								remove_from_to_be_checked(nickname_entered+";_;"+q_num_entered)
								progresses[nickname_entered]['q'+q_num_entered+'_score'] = "Correct"
								broadcast_leaderboard()
								serialize()
							} else {
								print("You entered invalid score. (Should be 0 or 1)")
							}
							keep_asking_user(to_ask)
						}
					}
				}
			}
		}
	})
}

function in_username_socket_map(name_) {
	var keys = Object.keys(username_socket_map)
	for (var i=0; i<keys.length; i++) {
		if (name_===keys[i])
			return true
	}
	return false
}

function remove_from_to_be_checked(to_remove_) {
	/* serialize */
	if (to_be_checked.indexOf(to_remove_)!=-1) {
		to_be_checked.splice(to_be_checked.indexOf(to_remove_), 1)
	}
}

function extract_to_be_checked_from_progresses() {
	var r_value = []
	var keys = Object.keys(progresses)
	for (var i=0; i<keys.length; i++) {
		var temp = keys[i]
		for (var j=1; j<=num_questions; j++) {
			if (progresses[temp]['q'+j.toString()+'_end']!=-1 && progresses[temp]['q'+j.toString()+'_score']=="Unmarked") {
				r_value.push(temp+";_;"+j.toString())
			}
		}
	}
	return r_value
}

function broadcast_leaderboard() {
	var new_leaderboard = make_leaderboard()
	connectees.forEach( sock => {
		sock.emit('update_leaderboard', new_leaderboard)
	})
}

function copy_all_input_files(user_name_) {
	for (var i = 1; i<=num_questions; i++) {
		var file_name = "q"+i.toString()+".in"
		var read_path = path.join(__dirname, input_files_dir, file_name)
		var write_path = path.join(__dirname, home_dir, user_name_, "q"+i.toString(), file_name)
		fs.createReadStream(read_path).pipe(fs.createWriteStream(write_path));
	}
}

function make_leaderboard() {
	var leaderboard = get_total_scores()
	leaderboard.sort( (a,b) => {
		if (a.total_score > b.total_score)
			return 1
		if (a.total_score < b.total_score)
			return -1
		return 0
	})
	return leaderboard
}

function get_total_scores() {
	var to_return = []
	var all_user_names = Object.keys(progresses)
	all_user_names.forEach( user_name_gts => {
		var total_score = 0
		for (var i=1; i<=num_questions; i++) {
			if (progresses[user_name_gts]['q'+i.toString()+'_score']!="Correct")
				total_score+=parseInt(default_score)
			else {
				// if (progresses[user_name_gts]['q'+i.toString()+'_score']=="Correct") {
				total_score+=parseInt(progresses[user_name_gts]['q'+i.toString()+'_time_spent'])
				// }
			}
		}
		if (total_score<num_questions*default_score) {
			var result = get_names_for_user_name(user_name_gts)
			if (result[0]) // "names" exists for this user_name in the database
				to_return.push({'user_name': user_name_gts, names: result[1], total_score: total_score})
			else {
				print("No name exists in the database for: " + user_name_gts)
			}
		}
	})
	return to_return
}

function get_names_for_user_name(user_name_) {
	for (var i in database) {
		if (database[i]['user_name']===user_name_) {
			return [true, database[i]['names']]
		}
	}
	return [false]
}

function remove_from_connectees(element) {
	if (connectees.indexOf(element)!=-1) {
		connectees.splice(connectees.indexOf(element), 1)
	}
}

function get_score_promisified(user_name_, q_num_, output_) {
	/* writes output of a question in scoring_dir and then
	calls the checking code for that respective question */
	return new Promise( (resolve, reject) => {
		var path_to_file = path.join(__dirname, scoring_dir, user_name_+'_q'+q_num_+'.txt')
		fs.writeFileSync(path_to_file, output_)
		var to_execute = "python check_q"+q_num_+".py " + path_to_file
		execute(to_execute, (error, stdout, stderr) => {
			if (error) {
				resolve("MY_ERROR:\n"+stderr)
			} else {
				resolve("SCORE:\n"+stdout)
			}
		})
	})
}

function compile_and_run_promisified(user_name_, q_num_, file_name_) {
	return new Promise ( (resolve, reject) => {
		var is_cpp_file = file_name_.indexOf(".cpp")
		var is_py_file = file_name_.indexOf(".py")
		var is_java_file = file_name_.indexOf(".java")

		var till_clients_dir = "cd "+home_dir+" && cd "+user_name_+
							" && cd q"+q_num_.toString()+" "

		// new_home_dir = path.join(home_dir, user_name_, 'q'+q_num_)
		var to_execute = ""
		// to_execute += "timeout 5 "
		var can_execute = false
		if (is_cpp_file!=-1) {
			can_execute = true
			to_execute += till_clients_dir + "&& timeout " + timeout_duration.toString() + " g++ " + file_name_ + " -o a.out && ./a.out"
			// to_execute = "g++ " + path.join(new_home_dir, file_name_)
			// 			 + " -o " + path.join(new_home_dir, "a.out")
			// 			 + " && ./" + path.join(new_home_dir, "a.out")
		} else if (is_py_file!=-1) {
			can_execute = true
			to_execute += till_clients_dir + "&& timeout " + timeout_duration.toString() + " python "+file_name_
			// to_execute = "python " + path.join(new_home_dir, file_name_)
		} else if (is_java_file!=-1) {
			can_execute = true
			to_execute += till_clients_dir + "&& timeout " + timeout_duration.toString() + " javac " + file_name_
						+ " && java " + file_name_.replace(".java", "")
			// to_execute = "javac " + path.join(new_home_dir, file_name_)
			// 			+ " && java -cp " + new_home_dir + " " + file_name_.replace(".java", "")
		} else {
			print("Unknown file extension for "+user_name_+ "'s question "+q_num_+ " : filename : " + file_name_)
			resolve("ERROR:\n"+"Unknown file extension")
		}
		if (can_execute) {
			// to_execute += " & sleep 5; kill $!"
			// to_execute += " & PID=$!; sleep 3; kill $PID"
			execute(to_execute, (error, stdout, stderr) => {
				if (error) {
					// print("ERROR:\n"+stderr)
					resolve("ERROR:\n"+stderr)
				} else {
					// print("OUTPUT:\n"+stdout)
					resolve("OUTPUT:\n"+stdout)
				}
			})
		}
	})
}

function extract_progresses(file_name_) {
	var r_value = {};
	var all_file = fs.readFileSync('./'+file_name_, 'utf8');
	if (all_file.length < 2)
		return {}
	return JSON.parse(all_file);

	/*var r_value = {}
	var all_file = fs.readFileSync('./'+file_name_, 'utf8')
	var all_instances = all_file.split(new_prog_delim + new_line_delim)
	var last_instance = all_instances[all_instances.length-1]
	
	var all_details = last_instance.split(new_line_delim)
	
	if (all_details.length>0) {
		var num_users_from_file = parseInt(all_details[0])
		var num_attr_per_user_from_file = parseInt(all_details[1])

		var start_index = 2
		for (var i=0; i<num_users_from_file; i++) {
			var current_index = start_index + i*(2*num_attr_per_user_from_file+1)
			var user_name_ep = all_details[current_index]
			r_value[user_name_ep] = {}
			current_index+=1
			for (var j=0; j<num_attr_per_user_from_file; j++) {
				var attr = all_details[current_index]
				r_value[user_name_ep][attr] = all_details[current_index+1]
				current_index+=2
			}
		}
	}
	return r_value*/
}

function serialize() {
	/*fs.appendFileSync(progresses_file_name, serialize_progresses(), 'utf8')*/
	fs.writeFileSync(progresses_file_name, serialize_progresses(), 'utf8')

	var new_leaderboard = make_leaderboard()
	var data = ""
	new_leaderboard.forEach ( (obj, index) => {
		data+=(index+1).toString()+" => "+obj['user_name']+" : "+obj['names']+" : "+obj['total_score']+"\n"
	})
	fs.writeFileSync(leaderboard_file_name, data, 'utf8')
}

function serialize_progresses() {
	return JSON.stringify(progresses)

	/*var data = new_prog_delim + new_line_delim
	data += ((Object.keys(progresses)).length).toString() + new_line_delim
	data += (num_questions*num_attr_per_question).toString() + new_line_delim
	var keys = Object.keys(progresses)
	keys.forEach( key => { // key is user_name here
		data += key.toString() + new_line_delim
		var attr = ""
		for (var i=1; i<=num_questions; i++) {
			q_num_temp = 'q'+i.toString()

			attr = q_num_temp+'_start'; data += attr + new_line_delim
			data += (progresses[key][attr]).toString()+new_line_delim

			attr = q_num_temp+'_end'; data += attr + new_line_delim
			data += (progresses[key][attr]).toString()+new_line_delim

			attr = q_num_temp+'_code'; data += attr + new_line_delim
			data += (progresses[key][attr]).toString()+new_line_delim

			attr = q_num_temp+'_file_name'; data += attr + new_line_delim
			data += (progresses[key][attr]).toString()+new_line_delim

			attr = q_num_temp+'_time_spent'; data += attr + new_line_delim
			data += (progresses[key][attr]).toString()+new_line_delim

			attr = q_num_temp+'_score'; data += attr + new_line_delim
			data += (progresses[key][attr]).toString()+new_line_delim
		}
	})
	return data*/
}

function setup_user_dirs (user_name_) {
	try {
		var current_path = process.cwd()
		var till_user_name = path.join(current_path,home_dir,user_name_)
		var till_home = path.join(current_path, home_dir)
		if (fs.existsSync(till_user_name)) {
			for (var i=1; i<=num_questions; i++) {
				fs.mkdirSync(path.join(till_user_name,'q'+i.toString()))
			}
			print(user_name_.toString() + " 's directories setup successfully")
		} else if (!fs.existsSync(till_home)) {
			fs.mkdirSync(till_home);
			setup_user_dirs(user_name_)
		} else if (!fs.existsSync(till_user_name)) {
			fs.mkdirSync(till_user_name)
			setup_user_dirs(user_name_)
		}
	} catch (err) {}
}

function get_proper_time(user_name_, q_num_, str) {
	return (new Date(progresses[user_name_]['q'+q_num_.toString()+str]*1000)).toTimeString().replace("GMT+0500 ", '')
}

function make_hashmap(user_name_) {
	// var progress = progresses[user_name_]
	var hashmap = {}
	for (var i=1; i<=num_questions; i++) {
		var status = ''
		var progress = progresses[user_name_]['q'+i.toString()+'_score']
		if ( progresses[user_name_]['q'+i.toString()+'_time_spent'] !=-1) {
			status = progresses[user_name_]['q'+i.toString()+'_time_spent'] + ' seconds : ' + progress
			// finished and marked correct or incorrect
		} else {
			if (progresses[user_name_]['q'+i.toString()+'_start']==-1) {
				status = "Haven't started yet"
				// not started
			} else {
				if (progresses[user_name_]['q'+i.toString()+'_end']==-1) {
					status = 'Started at ' + get_proper_time(user_name_, i, '_start')
					// started
				} else {
					status = progresses[user_name_]['q'+i.toString()+'_time_spent'] + ' seconds : ' + progress
					// finished but unmarked
				}
			}
		}

		if (progresses[user_name_]['q'+i.toString()+'_time_spent']!=-1)
			hashmap['q'+i.toString()] = [false, status]
		else
			hashmap['q'+i.toString()] = [true, status]
	}
	return hashmap
}

function readable_date(ms) {
	return (new Date(ms).toTimeString())
}

function in_progresses(user_name_) {
	var keys = Object.keys(progresses)
	for (var i=0; i<keys.length; i++) {
		if (user_name_===keys[i])
			return true
	}
	return false
}

function add_new_progress(user_name_) {
	progresses[user_name_.toString()] = {
		q1_start: -1, q1_end: -1, q1_code: -1, q1_file_name: -1, q1_time_spent: -1, q1_score: "Unmarked"
		, q2_start: -1, q2_end: -1, q2_code: -1, q2_file_name: -1, q2_time_spent: -1, q2_score: "Unmarked"
		, q3_start: -1, q3_end: -1, q3_code: -1, q3_file_name: -1, q3_time_spent: -1, q3_score: "Unmarked"
		, q4_start: -1, q4_end: -1, q4_code: -1, q4_file_name: -1, q4_time_spent: -1, q4_score: "Unmarked"
	}
}

function get_current_time() {
	return (Math.floor(new Date().getTime()/1000))
}

function build_database(file) {
	var db = []
	var lines = file.split("\n")
	lines.forEach( line => {
		var pieces = line.split("\t")

		if (pieces.length>1) {
			var nn = pieces[0]; var pwd = pieces[1];
			var r_num_1 = pieces[2]; var r_num_2 = pieces[3];
			var name_1 = pieces[4]; var name_2 = pieces[5];
			var name_of_group = ((name_1.split(" "))[0]).toUpperCase() + " && " + ((name_2.split(" "))[0]).toUpperCase()

			db.push({user_name: nn, password: pwd, names: name_of_group,
					roll_number1: r_num_1, roll_number2: r_num_2, 
					name1: name_1, name2: name_2})
		}
	})
	return db
}

function in_database(user_name_, pass) {
	for (var i in database) {
		if (database[i]['user_name']===user_name_ && database[i]['password']===pass) {
			return [true, database[i]['names']]
		}
	}
	return [false]
}

function print(to_print) {
	console.log(to_print)
}

function readFilePromisified(f_name) {
	return new Promise(
		function (resolve, reject) {
			fs.readFile(f_name, 'utf8', (error, data) => {
				if (error) {
					reject(error);
				} else {
					resolve(data);
				}
			})
		})
}

/*  keep_asking_user
	if asked for next
        give next
    else
        process input entered
        if len(input entered) !=3
            wrong format
            ask everything again
        else
            if (nickname doesn't exist in progresses)
                wrong format
                ask everything again
            else
                if (question hasn't been finished)
                    wronng timing
                    ask everything again
                else
                    if user has done question
                        confirm will and score accordingly
                        ask everything again
                    else if score is correct
                        score accordingly
                        ask everything again
                    else
                        wrong format
                        ask everything again
*/
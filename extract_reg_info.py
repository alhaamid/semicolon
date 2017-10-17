def extract_reg_info(i_name, o_name):
	input_file = open(i_name, 'r')
	output_file = open(o_name, 'w')

	input_file.readline()
	for line in input_file:
		pieces = line.split(",")
		nickname = pieces[1][1: -1]
		nickname = nickname.replace("/", "")
		nickname = nickname.replace(" ", "")
		nickname = nickname.replace("-", "")
		nickname = nickname.replace(",", "")
		nickname = nickname.replace(";", "")
		nickname = nickname.replace(":", "")
		nickname = nickname.lower()
		nickname = nickname.strip()
		num_1 = pieces[2][1: -1]
		name_1 = pieces[3][1: -1]
		num_2 = pieces[4][1: -1]
		name_2 = pieces[5][1: -1]
		password = pieces[6][1: -2]

		output_file.write(nickname + "\t" + password + "\t" + num_1 + "\t" + num_2 + "\t" + name_1 + "\t" + name_2 + "\n")

	input_file.close()
	output_file.close()

if __name__ == "__main__":
	extract_reg_info("The Sem;Colon Registration.csv", "database.txt")